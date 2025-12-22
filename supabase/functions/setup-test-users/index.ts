import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestUser {
  userId: string
  fullName: string
  role: 'admin' | 'evaluator' | 'manager' | 'new_joinee'
  cohort?: string
}

const TEMP_PASSWORD = 'Test@123!'

const testUsers: TestUser[] = [
  { userId: 'MSWIL_A001', fullName: 'Admin User', role: 'admin' },
  { userId: 'MSWIL_M001', fullName: 'Manager User', role: 'manager' },
  { userId: 'MSWIL_E001', fullName: 'Evaluator User', role: 'evaluator' },
  { userId: 'MSWIL_N001', fullName: 'New Joinee User', role: 'new_joinee', cohort: 'Cohort 2024' },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const createdUsers: { userId: string; email: string; role: string; password: string }[] = []
    const errors: { userId: string; error: string }[] = []

    for (const user of testUsers) {
      const email = `${user.userId.toLowerCase()}@company.local`
      
      console.log(`Creating user: ${user.userId} (${email})`)

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: TEMP_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: user.fullName,
          employee_id: user.userId
        }
      })

      if (authError) {
        console.error(`Failed to create auth user ${user.userId}:`, authError)
        errors.push({ userId: user.userId, error: authError.message })
        continue
      }

      if (!authData.user) {
        errors.push({ userId: user.userId, error: 'No user returned from auth' })
        continue
      }

      console.log(`Auth user created: ${authData.user.id}`)

      // Assign role
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: user.role
        })

      if (roleError) {
        console.error(`Failed to assign role for ${user.userId}:`, roleError)
        errors.push({ userId: user.userId, error: `Role assignment failed: ${roleError.message}` })
        continue
      }

      // Update profile with cohort if new_joinee
      if (user.cohort) {
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ cohort: user.cohort, user_id: user.userId })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error(`Failed to update profile for ${user.userId}:`, profileError)
        }
      } else {
        // Update user_id in profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ user_id: user.userId })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error(`Failed to update profile for ${user.userId}:`, profileError)
        }
      }

      createdUsers.push({
        userId: user.userId,
        email,
        role: user.role,
        password: TEMP_PASSWORD
      })

      console.log(`Successfully created user: ${user.userId} with role ${user.role}`)
    }

    const result = {
      success: true,
      message: `Created ${createdUsers.length} users`,
      users: createdUsers,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('Setup complete:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Setup error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
