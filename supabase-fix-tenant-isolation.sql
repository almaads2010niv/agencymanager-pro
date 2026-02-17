-- ============================================================
-- CRITICAL FIX: Tenant Data Isolation
-- current_tenant_id() must NEVER fallback to DEFAULT_TENANT_ID
-- If user has no role → return impossible UUID → sees NO data
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Fix current_tenant_id() — NO COALESCE to default!
--    If user is not in user_roles → returns impossible UUID → RLS blocks ALL data
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid  -- impossible UUID, matches NO tenant
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Verify: run as anon or a new user to confirm it returns the zero UUID
-- SELECT current_tenant_id();

-- 3. Verify all existing user_roles have valid tenant_id
SELECT ur.email, ur.tenant_id, t.name as tenant_name
FROM user_roles ur
LEFT JOIN tenants t ON ur.tenant_id = t.id
ORDER BY ur.created_at;
