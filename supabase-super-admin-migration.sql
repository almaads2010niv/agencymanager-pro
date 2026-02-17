-- ============================================================
-- Super Admin Migration
-- Adds is_super_admin flag + RLS for cross-tenant management
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add is_super_admin column to user_roles
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_super_admin boolean DEFAULT false;

-- 2. Create is_super_admin() helper function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. Update RLS on tenants — super admin gets full CRUD
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "tenants_insert" ON tenants;
CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  TO authenticated WITH CHECK ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "tenants_update" ON tenants;
CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  TO authenticated USING ((SELECT is_super_admin()));

DROP POLICY IF EXISTS "tenants_delete" ON tenants;
CREATE POLICY "tenants_delete" ON tenants FOR DELETE
  TO authenticated USING ((SELECT is_super_admin()));

-- 4. Update RLS on user_roles — super admin sees all tenants' users
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    OR user_id = auth.uid()
    OR (SELECT is_super_admin())
  );

DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_super_admin())
    OR (SELECT is_admin())
    OR user_id = auth.uid()
    OR NOT EXISTS (SELECT 1 FROM user_roles)
  );

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_super_admin())
    OR (SELECT is_admin())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated
  USING ((SELECT is_super_admin()) OR (SELECT is_admin()));

-- 5. Verification queries
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_roles' AND column_name = 'is_super_admin';

-- 6. IMPORTANT: After running this, set your user as super admin:
-- UPDATE user_roles SET is_super_admin = true WHERE email = 'YOUR_EMAIL_HERE';
