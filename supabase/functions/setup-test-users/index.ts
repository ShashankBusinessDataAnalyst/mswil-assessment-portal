import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestUser {
  userId: string
  password: string
  fullName: string
  role: 'admin' | 'evaluator' | 'manager' | 'new_joinee'
}

// Generate a secure random password
function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const TEMP_PASSWORD = generateSecurePassword();

const testUsers: TestUser[] = [
  { userId: 'MSWIL_001', password: TEMP_PASSWORD, fullName: 'Admin User', role: 'admin' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const results = []

    for (const user of testUsers) {
      // Create user in auth system
      const email = `${user.userId}@company.local`
      
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
        }
      })

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
          console.log(`User ${user.userId} already exists, skipping...`)
          results.push({ userId: user.userId, status: 'already_exists' })
          continue
        }
        console.error('Auth error:', authError)
        throw authError
      }

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: user.role,
        })

      if (roleError && !roleError.message.includes('duplicate')) {
        throw roleError
      }

      results.push({ 
        userId: user.userId, 
        status: 'created', 
        id: authData.user.id,
        temporaryPassword: user.password 
      })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: 'Admin user created. Please save the temporary password and change it on first login.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
