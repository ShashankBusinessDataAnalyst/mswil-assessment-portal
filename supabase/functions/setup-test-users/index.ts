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

const testUsers: TestUser[] = [
  { userId: 'admin1', password: 'Pass@123', fullName: 'Admin User', role: 'admin' },
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
        if (authError.message.includes('already registered')) {
          results.push({ userId: user.userId, status: 'already_exists' })
          continue
        }
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

      results.push({ userId: user.userId, status: 'created', id: authData.user.id })
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
