import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT to verify admin role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to verify admin role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log('Failed to get user:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', user.id);

    // Create admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Verify user is an admin using the has_role function
    const { data: isAdmin, error: roleError } = await adminClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError || !isAdmin) {
      console.log('User is not an admin:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin role verified');

    // Parse request body
    const { userId, fullName, employeeId, cohort, department, role } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating user:', userId, { fullName, employeeId, cohort, department, role });

    // Update profile in profiles table
    const profileUpdate: Record<string, string | null> = {};
    if (fullName !== undefined) profileUpdate.full_name = fullName;
    if (employeeId !== undefined) profileUpdate.employee_id = employeeId;
    if (cohort !== undefined) profileUpdate.cohort = cohort || null;
    if (department !== undefined) profileUpdate.department = department || null;

    if (Object.keys(profileUpdate).length > 0) {
      profileUpdate.updated_at = new Date().toISOString();
      
      const { error: profileError } = await adminClient
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (profileError) {
        console.error('Failed to update profile:', profileError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to update profile: ' + profileError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Profile updated successfully');
    }

    // Update role if provided
    if (role !== undefined) {
      // First, get existing roles for this user
      const { data: existingRoles, error: fetchRolesError } = await adminClient
        .from('user_roles')
        .select('id, role')
        .eq('user_id', userId);

      if (fetchRolesError) {
        console.error('Failed to fetch existing roles:', fetchRolesError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch roles: ' + fetchRolesError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete existing roles (user should have one primary role)
      if (existingRoles && existingRoles.length > 0) {
        const { error: deleteError } = await adminClient
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        if (deleteError) {
          console.error('Failed to delete existing roles:', deleteError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to update role: ' + deleteError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Insert new role
      const { error: insertRoleError } = await adminClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role: role,
          assigned_by: user.id,
          assigned_at: new Date().toISOString()
        });

      if (insertRoleError) {
        console.error('Failed to insert new role:', insertRoleError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to assign role: ' + insertRoleError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Role updated successfully to:', role);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User updated successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
