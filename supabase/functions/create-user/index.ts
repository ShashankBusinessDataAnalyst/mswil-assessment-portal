import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Get the current user making the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: currentUser }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !currentUser) {
      throw new Error('Unauthorized')
    }

    const { email, password, fullName, employeeId, role, cohort } = await req.json()

    // Validate inputs (employeeId and cohort are optional)
    if (!email || !password || !fullName || !role) {
      throw new Error('Missing required fields')
    }

    // Auto-generate User ID based on role
    let userId: string
    if (role === 'admin') {
      // Get the next available admin ID
      const { data: existingAdmins } = await supabaseAdmin
        .from('profiles')
        .select('employee_id')
        .ilike('employee_id', 'MSWIL_A%')
        .order('employee_id', { ascending: false })
        .limit(1)
      
      const lastAdminNum = existingAdmins && existingAdmins.length > 0 
        ? parseInt(existingAdmins[0].employee_id.replace('MSWIL_A', ''))
        : 0
      userId = `MSWIL_A${String(lastAdminNum + 1).padStart(3, '0')}`
    } else if (role === 'evaluator') {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('employee_id')
        .ilike('employee_id', 'MSWIL_E%')
        .order('employee_id', { ascending: false })
        .limit(1)
      
      const lastNum = existing && existing.length > 0 
        ? parseInt(existing[0].employee_id.replace('MSWIL_E', ''))
        : 0
      userId = `MSWIL_E${String(lastNum + 1).padStart(3, '0')}`
    } else if (role === 'manager') {
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('employee_id')
        .ilike('employee_id', 'MSWIL_M%')
        .order('employee_id', { ascending: false })
        .limit(1)
      
      const lastNum = existing && existing.length > 0 
        ? parseInt(existing[0].employee_id.replace('MSWIL_M', ''))
        : 0
      userId = `MSWIL_M${String(lastNum + 1).padStart(3, '0')}`
    } else { // new_joinee
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('employee_id')
        .ilike('employee_id', 'MSWIL_N%')
        .order('employee_id', { ascending: false })
        .limit(1)
      
      const lastNum = existing && existing.length > 0 
        ? parseInt(existing[0].employee_id.replace('MSWIL_N', ''))
        : 0
      userId = `MSWIL_N${String(lastNum + 1).padStart(3, '0')}`
    }


    // Create email from userId
    const authEmail = `${userId}@company.local`

    // Create user in auth system
    const userMetadata: { full_name: string; employee_id?: string; cohort?: string } = {
      full_name: fullName,
    }
    
    // Include employee_id if provided, otherwise use auto-generated userId
    userMetadata.employee_id = employeeId || userId
    
    // Include cohort for new joinee
    if (cohort) {
      userMetadata.cohort = cohort
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })

    if (authError) {
      throw authError
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: role,
        assigned_by: currentUser.id,
      })

    if (roleError) {
      throw roleError
    }

    // Update profile with cohort if provided
    if (cohort) {
      await supabaseAdmin
        .from('profiles')
        .update({ cohort })
        .eq('id', authData.user.id)
    }

    // Fetch the profile to get the final employee_id
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('employee_id, cohort')
      .eq('id', authData.user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
    }

    const finalEmployeeId = profileData?.employee_id || employeeId || userId

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: authData.user.id,
          userId,
          email,
          fullName,
          employeeId: finalEmployeeId,
          role,
          cohort: profileData?.cohort || cohort
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error creating user:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
