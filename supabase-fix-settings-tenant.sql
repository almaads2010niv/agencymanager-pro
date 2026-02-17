-- ============================================================
-- FIX: Settings table — per-tenant settings (not global id:1)
-- Each tenant gets its own settings row, keyed by tenant_id
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add UNIQUE constraint on tenant_id so upsert works
-- (tenant_id column already exists from multi-tenant migration)
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_tenant_unique;
ALTER TABLE settings ADD CONSTRAINT settings_tenant_unique UNIQUE (tenant_id);

-- 2. Make sure the existing settings row (id=1) has the correct tenant_id
UPDATE settings
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- 3. Fix RLS policies for settings — need explicit INSERT + UPDATE + SELECT + DELETE
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'settings' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON settings'; END LOOP;
END $$;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read their tenant's settings
CREATE POLICY "settings_select" ON settings FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());

-- INSERT: admin can create settings for their tenant
CREATE POLICY "settings_insert" ON settings FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

-- UPDATE: admin can update their tenant's settings
CREATE POLICY "settings_update" ON settings FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- DELETE: only super admin
CREATE POLICY "settings_delete" ON settings FOR DELETE TO authenticated
  USING ((SELECT is_super_admin()));

-- 4. Verify
SELECT id, tenant_id, agency_name FROM settings;
