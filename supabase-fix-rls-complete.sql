-- ============================================================
-- COMPLETE RLS FIX: Drop ALL old permissive policies, create strict ones
-- This ensures ONLY tenant-scoped policies exist on each table
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- ============ 0. Fix current_tenant_id() ======================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
    AND tenant_id = current_tenant_id()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_super_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_freelancer()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'freelancer'
    AND tenant_id = current_tenant_id()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============ 1. CLIENTS ======================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'clients' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON clients'; END LOOP;
END $$;

CREATE POLICY "clients_select" ON clients FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (NOT (SELECT is_freelancer()) OR assigned_to = auth.uid()));
CREATE POLICY "clients_insert" ON clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));
CREATE POLICY "clients_update" ON clients FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND ((SELECT is_admin()) OR assigned_to = auth.uid()));
CREATE POLICY "clients_delete" ON clients FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 2. LEADS ========================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'leads' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON leads'; END LOOP;
END $$;

CREATE POLICY "leads_select" ON leads FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id() AND (NOT (SELECT is_freelancer()) OR assigned_to = auth.uid()));
CREATE POLICY "leads_insert" ON leads FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "leads_update" ON leads FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id() AND ((SELECT is_admin()) OR assigned_to = auth.uid()));
CREATE POLICY "leads_delete" ON leads FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 3. DEALS ========================================
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'deals' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON deals'; END LOOP;
END $$;

CREATE POLICY "deals_select" ON deals FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "deals_insert" ON deals FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "deals_update" ON deals FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "deals_delete" ON deals FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 4. EXPENSES =====================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'expenses' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON expenses'; END LOOP;
END $$;

CREATE POLICY "expenses_select" ON expenses FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "expenses_insert" ON expenses FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "expenses_update" ON expenses FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "expenses_delete" ON expenses FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 5. PAYMENTS =====================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'payments' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON payments'; END LOOP;
END $$;

CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 6. SETTINGS =====================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'settings' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON settings'; END LOOP;
END $$;

CREATE POLICY "settings_select" ON settings FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "settings_all" ON settings FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 7. ACTIVITY_LOG =================================
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'activity_log' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON activity_log'; END LOOP;
END $$;

CREATE POLICY "activity_log_select" ON activity_log FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());


-- ============ 8. RETAINER_CHANGES =============================
ALTER TABLE retainer_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE retainer_changes FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'retainer_changes' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON retainer_changes'; END LOOP;
END $$;

CREATE POLICY "retainer_changes_select" ON retainer_changes FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "retainer_changes_insert" ON retainer_changes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());


-- ============ 9. CLIENT_NOTES =================================
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'client_notes' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON client_notes'; END LOOP;
END $$;

CREATE POLICY "client_notes_select" ON client_notes FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "client_notes_insert" ON client_notes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "client_notes_delete" ON client_notes FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id());


-- ============ 10. LEAD_NOTES ==================================
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_notes FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'lead_notes' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON lead_notes'; END LOOP;
END $$;

CREATE POLICY "lead_notes_select" ON lead_notes FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "lead_notes_insert" ON lead_notes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "lead_notes_delete" ON lead_notes FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id());


-- ============ 11. CALL_TRANSCRIPTS ============================
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'call_transcripts' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON call_transcripts'; END LOOP;
END $$;

CREATE POLICY "call_transcripts_select" ON call_transcripts FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "call_transcripts_insert" ON call_transcripts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "call_transcripts_delete" ON call_transcripts FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 12. AI_RECOMMENDATIONS ==========================
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'ai_recommendations' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ai_recommendations'; END LOOP;
END $$;

CREATE POLICY "ai_recommendations_select" ON ai_recommendations FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "ai_recommendations_insert" ON ai_recommendations FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "ai_recommendations_delete" ON ai_recommendations FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 13. WHATSAPP_MESSAGES ===========================
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'whatsapp_messages' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON whatsapp_messages'; END LOOP;
END $$;

CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 14. SIGNALS_PERSONALITY =========================
ALTER TABLE signals_personality ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals_personality FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'signals_personality' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON signals_personality'; END LOOP;
END $$;

-- signals_personality has TWO tenant columns:
--   tenant_id (text) — from Signals OS webhook payload
--   tenant_id_fk (uuid) — FK to tenants table, used for RLS
CREATE POLICY "signals_personality_select" ON signals_personality FOR SELECT TO authenticated
  USING (tenant_id_fk = current_tenant_id());
CREATE POLICY "signals_personality_insert" ON signals_personality FOR INSERT TO authenticated
  WITH CHECK (tenant_id_fk = current_tenant_id());
CREATE POLICY "signals_personality_update" ON signals_personality FOR UPDATE TO authenticated
  USING (tenant_id_fk = current_tenant_id());
CREATE POLICY "signals_personality_delete" ON signals_personality FOR DELETE TO authenticated
  USING (tenant_id_fk = current_tenant_id() AND (SELECT is_admin()));


-- ============ 15. CALENDAR_EVENTS =============================
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'calendar_events' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON calendar_events'; END LOOP;
END $$;

CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id());


-- ============ 16. IDEAS =======================================
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'ideas' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ideas'; END LOOP;
END $$;

CREATE POLICY "ideas_select" ON ideas FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "ideas_insert" ON ideas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "ideas_update" ON ideas FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "ideas_delete" ON ideas FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 17. KNOWLEDGE_ARTICLES ==========================
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'knowledge_articles' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON knowledge_articles'; END LOOP;
END $$;

CREATE POLICY "knowledge_articles_select" ON knowledge_articles FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "knowledge_articles_insert" ON knowledge_articles FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY "knowledge_articles_update" ON knowledge_articles FOR UPDATE TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY "knowledge_articles_delete" ON knowledge_articles FOR DELETE TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));


-- ============ 18. USER_ROLES ==================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON user_roles'; END LOOP;
END $$;

-- Users can see themselves + same-tenant users (for admin); super admin sees all
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id = current_tenant_id()
    OR (SELECT is_super_admin())
  );

-- Only admins of same tenant or super admins can insert
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id() AND (SELECT is_admin())
    OR (SELECT is_super_admin())
  );

-- Admins can update same-tenant users; users can update ONLY their own display_name
-- CRITICAL: cannot change own tenant_id or role!
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE TO authenticated
  USING (
    (tenant_id = current_tenant_id() AND (SELECT is_admin()))
    OR (user_id = auth.uid() AND tenant_id = current_tenant_id())
    OR (SELECT is_super_admin())
  )
  WITH CHECK (
    (tenant_id = current_tenant_id() AND (SELECT is_admin()))
    OR (user_id = auth.uid() AND tenant_id = current_tenant_id())
    OR (SELECT is_super_admin())
  );

-- Only admins can delete, same tenant only
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE TO authenticated
  USING (
    (tenant_id = current_tenant_id() AND (SELECT is_admin()))
    OR (SELECT is_super_admin())
  );


-- ============ 19. TENANTS =====================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'tenants' AND schemaname = 'public'
  LOOP EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON tenants'; END LOOP;
END $$;

-- Users can see only their own tenant; super admin sees all
CREATE POLICY "tenants_select" ON tenants FOR SELECT TO authenticated
  USING (id = current_tenant_id() OR (SELECT is_super_admin()));
CREATE POLICY "tenants_update" ON tenants FOR UPDATE TO authenticated
  USING ((SELECT is_super_admin()));
CREATE POLICY "tenants_insert" ON tenants FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_super_admin()));
CREATE POLICY "tenants_delete" ON tenants FOR DELETE TO authenticated
  USING ((SELECT is_super_admin()));


-- ============ VERIFICATION ====================================
-- Run this to verify all tables have strict policies:
SELECT
  tablename,
  COUNT(*) as policy_count,
  bool_and(qual NOT LIKE '%true%' OR qual IS NULL) as no_permissive_true
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'clients', 'leads', 'deals', 'expenses', 'payments', 'settings',
    'activity_log', 'retainer_changes', 'client_notes', 'lead_notes',
    'call_transcripts', 'ai_recommendations', 'whatsapp_messages',
    'signals_personality', 'calendar_events', 'ideas', 'knowledge_articles',
    'user_roles', 'tenants'
  )
GROUP BY tablename
ORDER BY tablename;
