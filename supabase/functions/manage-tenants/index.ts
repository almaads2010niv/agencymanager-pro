// Supabase Edge Function: manage-tenants
// Super Admin operations for tenant management
// Deploy: npx supabase functions deploy manage-tenants --project-ref rxckkozbkrabpjdgyxqm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) return jsonResponse({ error: 'Invalid token' }, 401)

    // Check super admin status using service_role (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: callerRole } = await adminClient
      .from('user_roles')
      .select('role, is_super_admin')
      .eq('user_id', caller.id)
      .single()

    if (!callerRole?.is_super_admin) {
      return jsonResponse({ error: 'Only super admins can manage tenants' }, 403)
    }

    const { action, ...params } = await req.json()

    // ── LIST TENANTS ──────────────────────────────────────────
    if (action === 'list-tenants') {
      const { data: tenants, error } = await adminClient
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) return jsonResponse({ error: error.message }, 500)

      // Get user counts per tenant
      const { data: userCounts } = await adminClient
        .from('user_roles')
        .select('tenant_id')

      const countMap = new Map<string, number>()
      userCounts?.forEach((u: { tenant_id: string }) => {
        countMap.set(u.tenant_id, (countMap.get(u.tenant_id) || 0) + 1)
      })

      const result = tenants?.map((t: { id: string; name: string; slug: string; created_at: string }) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.created_at,
        userCount: countMap.get(t.id) || 0,
      }))

      return jsonResponse({ success: true, tenants: result })
    }

    // ── CREATE TENANT ─────────────────────────────────────────
    if (action === 'create-tenant') {
      const { name, slug } = params
      if (!name) return jsonResponse({ error: 'name is required' }, 400)

      // Auto-generate slug if not provided
      const finalSlug = slug || name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() || `tenant-${Date.now()}`

      const { data, error } = await adminClient
        .from('tenants')
        .insert({ name, slug: finalSlug })
        .select()
        .single()

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          return jsonResponse({ error: 'slug_exists' }, 409)
        }
        return jsonResponse({ error: error.message }, 500)
      }

      return jsonResponse({ success: true, tenant: data })
    }

    // ── UPDATE TENANT ─────────────────────────────────────────
    if (action === 'update-tenant') {
      const { tenantId, name, slug } = params
      if (!tenantId) return jsonResponse({ error: 'tenantId is required' }, 400)

      const updates: Record<string, string> = {}
      if (name) updates.name = name
      if (slug) updates.slug = slug

      const { error } = await adminClient
        .from('tenants')
        .update(updates)
        .eq('id', tenantId)

      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ success: true })
    }

    // ── GET TENANT USERS ──────────────────────────────────────
    if (action === 'get-tenant-users') {
      const { tenantId } = params
      if (!tenantId) return jsonResponse({ error: 'tenantId is required' }, 400)

      const { data: users, error } = await adminClient
        .from('user_roles')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })

      if (error) return jsonResponse({ error: error.message }, 500)

      const result = users?.map((u: {
        id: string;
        user_id: string;
        email: string;
        display_name: string;
        role: string;
        is_super_admin: boolean;
        created_at: string;
      }) => ({
        id: u.id,
        userId: u.user_id,
        email: u.email || '',
        displayName: u.display_name || '',
        role: u.role,
        isSuperAdmin: u.is_super_admin || false,
        createdAt: u.created_at,
      }))

      return jsonResponse({ success: true, users: result })
    }

    // ── CREATE TENANT USER ────────────────────────────────────
    if (action === 'create-tenant-user') {
      const { tenantId, email, password, displayName, role } = params
      if (!tenantId || !email || !password || !displayName) {
        return jsonResponse({ error: 'tenantId, email, password, and displayName are required' }, 400)
      }
      if (password.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)
      }

      const validRoles = ['admin', 'viewer', 'freelancer']
      const userRole = validRoles.includes(role) ? role : 'viewer'
      const trimmedEmail = email.toLowerCase().trim()

      // Create auth user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: trimmedEmail,
        password,
        email_confirm: true,
      })

      if (createError) {
        if (createError.message?.includes('already been registered') || createError.message?.includes('already exists')) {
          return jsonResponse({ error: 'email_exists' }, 409)
        }
        return jsonResponse({ error: createError.message }, 400)
      }

      // Default permissions by role
      const defaultPermissions = userRole === 'admin'
        ? ['dashboard', 'clients', 'leads', 'deals', 'expenses', 'debts', 'profit_loss', 'tax_calculator', 'calendar', 'ideas', 'knowledge', 'settings']
        : userRole === 'freelancer'
          ? ['dashboard', 'clients', 'leads', 'deals', 'calendar']
          : ['dashboard', 'leads']

      // Create user_roles entry
      const { error: roleError } = await adminClient
        .from('user_roles')
        .insert({
          user_id: newUser.user!.id,
          email: trimmedEmail,
          role: userRole,
          display_name: displayName,
          page_permissions: JSON.stringify(defaultPermissions),
          tenant_id: tenantId,
        })

      if (roleError) return jsonResponse({ error: roleError.message }, 500)

      return jsonResponse({
        success: true,
        userId: newUser.user!.id,
        email: trimmedEmail,
      })
    }

    // ── REMOVE TENANT USER ────────────────────────────────────
    if (action === 'remove-tenant-user') {
      const { userId } = params
      if (!userId) return jsonResponse({ error: 'userId is required' }, 400)

      // Don't allow removing yourself
      if (userId === caller.id) {
        return jsonResponse({ error: 'Cannot remove yourself' }, 400)
      }

      // Delete from user_roles
      const { error: roleError } = await adminClient
        .from('user_roles')
        .delete()
        .eq('user_id', userId)

      if (roleError) return jsonResponse({ error: roleError.message }, 500)

      // Delete from auth
      const { error: authError } = await adminClient.auth.admin.deleteUser(userId)
      if (authError) console.error('Warning: failed to delete auth user:', authError.message)

      return jsonResponse({ success: true })
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400)

  } catch (err) {
    console.error('manage-tenants error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
