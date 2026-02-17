-- ============================================================
-- Multi-Tenant Migration
-- Adds tenant isolation to all tables + helper functions
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select" ON tenants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "tenants_insert" ON tenants FOR INSERT
  TO authenticated WITH CHECK ((SELECT is_admin()));

CREATE POLICY "tenants_update" ON tenants FOR UPDATE
  TO authenticated USING ((SELECT is_admin()));

-- 2. Insert default tenant (existing agency data)
INSERT INTO tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Agency', 'default')
ON CONFLICT (id) DO NOTHING;

-- 3. Add tenant_id to ALL data tables with default pointing to existing tenant
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE retainer_changes ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE lead_notes ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE call_transcripts ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

-- signals_personality already has a text tenant_id from Signals OS webhook
-- We add tenant_id_fk as the FK to our tenants table
ALTER TABLE signals_personality ADD COLUMN IF NOT EXISTS tenant_id_fk uuid
  DEFAULT '00000000-0000-0000-0000-000000000001'
  REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Indexes for tenant_id
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant ON calendar_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_retainer_changes_tenant ON retainer_changes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_tenant ON client_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_tenant ON lead_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_tenant ON call_transcripts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_tenant ON ai_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant ON whatsapp_messages(tenant_id);

-- 5. Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT tenant_id FROM user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. Update is_admin to also be tenant-aware
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 7. UPDATE ALL RLS POLICIES with tenant filtering
-- ============================================================

-- CLIENTS
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- LEADS
DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "leads_insert" ON leads;
CREATE POLICY "leads_insert" ON leads FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id()
    AND ((SELECT is_admin()) OR created_by = auth.uid() OR assigned_to = auth.uid()));

DROP POLICY IF EXISTS "leads_delete" ON leads;
CREATE POLICY "leads_delete" ON leads FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- DEALS
DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert" ON deals FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update" ON deals FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "deals_delete" ON deals;
CREATE POLICY "deals_delete" ON deals FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- EXPENSES
DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- PAYMENTS
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

DROP POLICY IF EXISTS "payments_delete" ON payments;
CREATE POLICY "payments_delete" ON payments FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- SETTINGS
DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "settings_upsert" ON settings;
CREATE POLICY "settings_upsert" ON settings FOR ALL
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()))
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- USER_ROLES
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id() OR user_id = auth.uid());

DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_admin())
    OR user_id = auth.uid()
    OR NOT EXISTS (SELECT 1 FROM user_roles)
  );

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ACTIVITY_LOG
DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

-- RETAINER_CHANGES
DROP POLICY IF EXISTS "retainer_changes_select" ON retainer_changes;
CREATE POLICY "retainer_changes_select" ON retainer_changes FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "retainer_changes_insert" ON retainer_changes;
CREATE POLICY "retainer_changes_insert" ON retainer_changes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- CLIENT_NOTES
DROP POLICY IF EXISTS "client_notes_select" ON client_notes;
CREATE POLICY "client_notes_select" ON client_notes FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "client_notes_insert" ON client_notes;
CREATE POLICY "client_notes_insert" ON client_notes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "client_notes_delete" ON client_notes;
CREATE POLICY "client_notes_delete" ON client_notes FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- LEAD_NOTES
DROP POLICY IF EXISTS "lead_notes_select" ON lead_notes;
CREATE POLICY "lead_notes_select" ON lead_notes FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "lead_notes_insert" ON lead_notes;
CREATE POLICY "lead_notes_insert" ON lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "lead_notes_delete" ON lead_notes;
CREATE POLICY "lead_notes_delete" ON lead_notes FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- CALL_TRANSCRIPTS
DROP POLICY IF EXISTS "call_transcripts_select" ON call_transcripts;
CREATE POLICY "call_transcripts_select" ON call_transcripts FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "call_transcripts_insert" ON call_transcripts;
CREATE POLICY "call_transcripts_insert" ON call_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "call_transcripts_delete" ON call_transcripts;
CREATE POLICY "call_transcripts_delete" ON call_transcripts FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- AI_RECOMMENDATIONS
DROP POLICY IF EXISTS "ai_recommendations_select" ON ai_recommendations;
CREATE POLICY "ai_recommendations_select" ON ai_recommendations FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "ai_recommendations_insert" ON ai_recommendations;
CREATE POLICY "ai_recommendations_insert" ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "ai_recommendations_delete" ON ai_recommendations;
CREATE POLICY "ai_recommendations_delete" ON ai_recommendations FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- WHATSAPP_MESSAGES
DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "whatsapp_messages_insert" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "whatsapp_messages_delete" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- CALENDAR_EVENTS
DROP POLICY IF EXISTS "calendar_events_select_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_insert_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_update_policy" ON calendar_events;
DROP POLICY IF EXISTS "calendar_events_delete_policy" ON calendar_events;

CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id());

-- SIGNALS_PERSONALITY (special: has text tenant_id from webhook + our tenant_id_fk)
DROP POLICY IF EXISTS "signals_personality_select" ON signals_personality;
CREATE POLICY "signals_personality_select" ON signals_personality FOR SELECT
  TO authenticated
  USING (tenant_id_fk = current_tenant_id());

-- Keep existing webhook insert policy (uses service_role, bypasses RLS)
-- Keep existing update policy

-- ============================================================
-- DONE! All tables now have tenant_id with default tenant.
-- Existing data automatically belongs to the default tenant.
-- ============================================================
