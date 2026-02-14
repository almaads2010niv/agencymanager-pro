// Supabase Edge Function: create-user
// Creates a new Supabase Auth user + user_roles entry (admin only)
// Deploy: npx supabase functions deploy create-user --project-ref <your-ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify the caller is an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create client with the caller's JWT to verify identity
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get calling user
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if caller is admin
    const { data: callerRole } = await callerClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single()

    if (!callerRole || callerRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse request body
    const { email, password, displayName } = await req.json()

    if (!email || !password || !displayName) {
      return new Response(JSON.stringify({ error: 'email, password, and displayName are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Use service_role client to create the auth user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true, // Auto-confirm email so they can login immediately
    })

    if (createError) {
      // Handle duplicate email
      if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
        return new Response(JSON.stringify({ error: 'email_exists' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Check if a pre-created user_roles entry exists for this email
    const trimmedEmail = email.toLowerCase().trim()
    const { data: existingRole } = await adminClient
      .from('user_roles')
      .select('*')
      .eq('email', trimmedEmail)
      .single()

    if (existingRole) {
      // Update the existing entry with the real user_id
      await adminClient
        .from('user_roles')
        .update({ user_id: newUser.user!.id })
        .eq('email', trimmedEmail)
    } else {
      // Create new user_roles entry
      await adminClient
        .from('user_roles')
        .insert({
          user_id: newUser.user!.id,
          email: trimmedEmail,
          role: 'viewer',
          display_name: displayName,
          page_permissions: JSON.stringify(['dashboard', 'leads']),
        })
    }

    return new Response(JSON.stringify({
      success: true,
      userId: newUser.user!.id,
      email: trimmedEmail,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
