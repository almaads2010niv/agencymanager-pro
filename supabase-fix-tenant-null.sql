-- ============================================================
-- COMPREHENSIVE FIX: tenant_id, current_tenant_id(), is_admin()
-- Fixes POST 400 errors on INSERT operations
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- 1. Ensure all user_roles have tenant_id set to default
UPDATE user_roles
SET tenant_id = '00000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- 2. Ensure all other tables have tenant_id set
UPDATE clients SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE leads SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE deals SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE expenses SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE payments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE activity_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE retainer_changes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE client_notes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE lead_notes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE call_transcripts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE ai_recommendations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE whatsapp_messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE calendar_events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE ideas SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE knowledge_articles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE signals_personality SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
-- signals_personality has a separate tenant_id_fk column used by RLS
UPDATE signals_personality SET tenant_id_fk = '00000000-0000-0000-0000-000000000001' WHERE tenant_id_fk IS NULL;

-- 3. Fix current_tenant_id() — COALESCE so it NEVER returns NULL
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Fix is_admin() — COALESCE so it works even if user_roles.tenant_id is NULL
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. Verify everything works
SELECT 'current_tenant_id()' AS fn, current_tenant_id()::text AS result
UNION ALL
SELECT 'is_admin()', (SELECT is_admin())::text;

-- Show user_roles data
SELECT user_id, email, role, tenant_id, display_name
FROM user_roles
LIMIT 10;
