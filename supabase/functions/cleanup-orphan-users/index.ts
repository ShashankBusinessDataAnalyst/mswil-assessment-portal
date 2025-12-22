import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase admin client
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

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid token')
    }

    // Check if user is admin
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (rolesError || !roles) {
      throw new Error('Only admins can perform cleanup')
    }

    console.log('Admin verified, starting cleanup...')

    // Get all auth users
    const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      throw new Error('Failed to list auth users')
    }

    console.log(`Found ${authUsers.users.length} total auth users`)

    // Get all user_ids that have roles
    const { data: usersWithRoles, error: rolesListError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')

    if (rolesListError) {
      console.error('Error fetching user roles:', rolesListError)
      throw new Error('Failed to fetch user roles')
    }

    const userIdsWithRoles = new Set(usersWithRoles?.map(r => r.user_id) || [])
    console.log(`Found ${userIdsWithRoles.size} users with roles`)

    // Find orphaned users (have auth entry but no role)
    const orphanedUsers = authUsers.users.filter(u => !userIdsWithRoles.has(u.id))
    console.log(`Found ${orphanedUsers.length} orphaned users to delete`)

    // Delete orphaned users
    const deleted: string[] = []
    const errors: { email: string; error: string }[] = []

    for (const orphan of orphanedUsers) {
      console.log(`Deleting orphaned user: ${orphan.email}`)
      
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(orphan.id)
      
      if (deleteError) {
        console.error(`Failed to delete ${orphan.email}:`, deleteError)
        errors.push({ email: orphan.email || 'unknown', error: deleteError.message })
      } else {
        deleted.push(orphan.email || 'unknown')
        console.log(`Successfully deleted: ${orphan.email}`)
      }
    }

    const result = {
      success: true,
      totalAuthUsers: authUsers.users.length,
      usersWithRoles: userIdsWithRoles.size,
      orphanedFound: orphanedUsers.length,
      deleted: deleted,
      deletedCount: deleted.length,
      errors: errors
    }

    console.log('Cleanup complete:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Cleanup error:', error)
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
