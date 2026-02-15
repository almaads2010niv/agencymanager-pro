-- ============================================================
-- AgencyManager Pro - Supabase Migrations & RLS Policies
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. NEW TABLES
-- ============================================================

-- Retainer change history
CREATE TABLE IF NOT EXISTS retainer_changes (
  id text PRIMARY KEY,
  client_id text REFERENCES clients(client_id) ON DELETE CASCADE,
  old_retainer numeric NOT NULL DEFAULT 0,
  new_retainer numeric NOT NULL DEFAULT 0,
  old_supplier_cost numeric NOT NULL DEFAULT 0,
  new_supplier_cost numeric NOT NULL DEFAULT 0,
  changed_at timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT ''
);

-- ============================================================
-- 2. COLUMN ADDITIONS (safe IF NOT EXISTS)
-- ============================================================

-- Page-level permissions for user roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'page_permissions') THEN
    ALTER TABLE user_roles ADD COLUMN page_permissions text DEFAULT NULL;
  END IF;
END $$;

-- Recurring expense flag
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'is_recurring') THEN
    ALTER TABLE expenses ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;
END $$;

-- Email column for pre-created viewer roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'email') THEN
    ALTER TABLE user_roles ADD COLUMN email text;
  END IF;
END $$;

-- Employee salary in settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'employee_salary') THEN
    ALTER TABLE settings ADD COLUMN employee_salary numeric DEFAULT 0;
  END IF;
END $$;

-- Lead created_by for viewer filtering
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'created_by') THEN
    ALTER TABLE leads ADD COLUMN created_by uuid;
  END IF;
END $$;

-- Assigned handler on clients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'assigned_to') THEN
    ALTER TABLE clients ADD COLUMN assigned_to uuid DEFAULT NULL;
  END IF;
END $$;

-- Client notes history table
CREATE TABLE IF NOT EXISTS client_notes (
  id text PRIMARY KEY,
  client_id text REFERENCES clients(client_id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. STORAGE BUCKET
-- ============================================================

-- Create contracts bucket for client file uploads (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contracts', 'contracts', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Helper: Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- --------------------------------------------------------
-- CLIENTS TABLE
-- --------------------------------------------------------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can read clients

DROP POLICY IF EXISTS "clients_insert" ON clients;
CREATE POLICY "clients_insert" ON clients FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "clients_update" ON clients;
CREATE POLICY "clients_update" ON clients FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "clients_delete" ON clients;
CREATE POLICY "clients_delete" ON clients FOR DELETE
  TO authenticated
  USING (is_admin());

-- --------------------------------------------------------
-- LEADS TABLE
-- --------------------------------------------------------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT
  TO authenticated
  USING (true); -- All authenticated users can view all leads

DROP POLICY IF EXISTS "leads_insert" ON leads;
CREATE POLICY "leads_insert" ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true); -- All authenticated users can create leads

DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "leads_delete" ON leads;
CREATE POLICY "leads_delete" ON leads FOR DELETE
  TO authenticated
  USING (is_admin());

-- --------------------------------------------------------
-- DEALS TABLE
-- --------------------------------------------------------
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "deals_insert" ON deals;
CREATE POLICY "deals_insert" ON deals FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "deals_update" ON deals;
CREATE POLICY "deals_update" ON deals FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "deals_delete" ON deals;
CREATE POLICY "deals_delete" ON deals FOR DELETE
  TO authenticated
  USING (is_admin());

-- --------------------------------------------------------
-- EXPENSES TABLE
-- --------------------------------------------------------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "expenses_insert" ON expenses;
CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "expenses_update" ON expenses;
CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "expenses_delete" ON expenses;
CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  TO authenticated
  USING (is_admin());

-- --------------------------------------------------------
-- PAYMENTS TABLE
-- --------------------------------------------------------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "payments_update" ON payments;
CREATE POLICY "payments_update" ON payments FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "payments_delete" ON payments;
CREATE POLICY "payments_delete" ON payments FOR DELETE
  TO authenticated
  USING (is_admin());

-- --------------------------------------------------------
-- SETTINGS TABLE
-- --------------------------------------------------------
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_upsert" ON settings;
CREATE POLICY "settings_upsert" ON settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- --------------------------------------------------------
-- USER_ROLES TABLE
-- --------------------------------------------------------
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
  TO authenticated
  USING (true); -- All can read roles (needed for auth)

DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can add users, OR user can self-insert (first login)
    is_admin()
    OR user_id = auth.uid()
    OR NOT EXISTS (SELECT 1 FROM user_roles)
  );

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated
  USING (is_admin());

-- --------------------------------------------------------
-- ACTIVITY_LOG TABLE
-- --------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log') THEN
    ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
CREATE POLICY "activity_log_select" ON activity_log FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
CREATE POLICY "activity_log_insert" ON activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true); -- All authenticated users can log activity

-- --------------------------------------------------------
-- RETAINER_CHANGES TABLE
-- --------------------------------------------------------
ALTER TABLE retainer_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retainer_changes_select" ON retainer_changes;
CREATE POLICY "retainer_changes_select" ON retainer_changes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "retainer_changes_insert" ON retainer_changes;
CREATE POLICY "retainer_changes_insert" ON retainer_changes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- --------------------------------------------------------
-- CLIENT_NOTES TABLE
-- --------------------------------------------------------
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_notes_select" ON client_notes;
CREATE POLICY "client_notes_select" ON client_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "client_notes_insert" ON client_notes;
CREATE POLICY "client_notes_insert" ON client_notes FOR INSERT
  TO authenticated
  WITH CHECK (true); -- All authenticated users can add notes

DROP POLICY IF EXISTS "client_notes_delete" ON client_notes;
CREATE POLICY "client_notes_delete" ON client_notes FOR DELETE
  TO authenticated
  USING (is_admin()); -- Only admins can delete notes

-- --------------------------------------------------------
-- STORAGE POLICIES (contracts bucket)
-- --------------------------------------------------------

DROP POLICY IF EXISTS "contracts_select" ON storage.objects;
CREATE POLICY "contracts_select" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contracts');

DROP POLICY IF EXISTS "contracts_insert" ON storage.objects;
CREATE POLICY "contracts_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND (SELECT is_admin()));

DROP POLICY IF EXISTS "contracts_delete" ON storage.objects;
CREATE POLICY "contracts_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contracts' AND (SELECT is_admin()));

-- ============================================================
-- 5. LEAD MANAGEMENT UPGRADE (assigned handler + notes)
-- ============================================================

-- Assigned handler on leads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_to') THEN
    ALTER TABLE leads ADD COLUMN assigned_to uuid DEFAULT NULL;
  END IF;
END $$;

-- Lead notes history table
CREATE TABLE IF NOT EXISTS lead_notes (
  id text PRIMARY KEY,
  lead_id text REFERENCES leads(lead_id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for lead_notes
ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_notes_select" ON lead_notes;
CREATE POLICY "lead_notes_select" ON lead_notes FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "lead_notes_insert" ON lead_notes;
CREATE POLICY "lead_notes_insert" ON lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (true); -- All authenticated users can add notes

DROP POLICY IF EXISTS "lead_notes_delete" ON lead_notes;
CREATE POLICY "lead_notes_delete" ON lead_notes FOR DELETE
  TO authenticated
  USING (is_admin()); -- Only admins can delete notes

-- ============================================================
-- 6. CALL TRANSCRIPTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS call_transcripts (
  id text PRIMARY KEY,
  client_id text DEFAULT NULL,
  lead_id text DEFAULT NULL,
  call_date timestamptz NOT NULL DEFAULT now(),
  participants text NOT NULL DEFAULT '',
  transcript text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ct_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_ct_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_transcripts_select" ON call_transcripts;
CREATE POLICY "call_transcripts_select" ON call_transcripts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "call_transcripts_insert" ON call_transcripts;
CREATE POLICY "call_transcripts_insert" ON call_transcripts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "call_transcripts_delete" ON call_transcripts;
CREATE POLICY "call_transcripts_delete" ON call_transcripts FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- 7. SETTINGS: API KEYS FOR INTEGRATIONS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'canva_api_key') THEN
    ALTER TABLE settings ADD COLUMN canva_api_key text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'canva_template_id') THEN
    ALTER TABLE settings ADD COLUMN canva_template_id text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'gemini_api_key') THEN
    ALTER TABLE settings ADD COLUMN gemini_api_key text DEFAULT NULL;
  END IF;
END $$;

-- ============================================================
-- 8. AI RECOMMENDATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id text PRIMARY KEY,
  client_id text DEFAULT NULL,
  lead_id text DEFAULT NULL,
  recommendation text NOT NULL DEFAULT '',
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_airec_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_airec_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_recommendations_select" ON ai_recommendations;
CREATE POLICY "ai_recommendations_select" ON ai_recommendations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "ai_recommendations_insert" ON ai_recommendations;
CREATE POLICY "ai_recommendations_insert" ON ai_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "ai_recommendations_delete" ON ai_recommendations;
CREATE POLICY "ai_recommendations_delete" ON ai_recommendations FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- 9. WHATSAPP MESSAGES + AUDIO RECORDINGS
-- ============================================================

-- WhatsApp outgoing messages history
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id text PRIMARY KEY,
  client_id text DEFAULT NULL,
  lead_id text DEFAULT NULL,
  message_text text NOT NULL DEFAULT '',
  message_purpose text NOT NULL DEFAULT '',
  phone_number text NOT NULL DEFAULT '',
  sent_by text NOT NULL,
  sent_by_name text NOT NULL DEFAULT '',
  is_ai_generated boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_wamsg_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_wamsg_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_messages_select" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "whatsapp_messages_insert" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "whatsapp_messages_delete" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_delete" ON whatsapp_messages FOR DELETE
  TO authenticated
  USING (is_admin());

-- Audio recordings storage bucket (50MB limit, audio formats)
-- NOTE: browsers report various MIME types for same format, so we allow all common variants
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings', 'recordings', false, 52428800,
  ARRAY['audio/mpeg','audio/mp4','audio/mp3','audio/m4a','audio/x-m4a','audio/wav','audio/webm','audio/ogg','audio/aac','audio/x-aac','video/mp4','audio/flac','audio/x-flac','application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['audio/mpeg','audio/mp4','audio/mp3','audio/m4a','audio/x-m4a','audio/wav','audio/webm','audio/ogg','audio/aac','audio/x-aac','video/mp4','audio/flac','audio/x-flac','application/octet-stream'];

-- Storage policies for recordings bucket
DROP POLICY IF EXISTS "recordings_select" ON storage.objects;
CREATE POLICY "recordings_select" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'recordings');

DROP POLICY IF EXISTS "recordings_insert" ON storage.objects;
CREATE POLICY "recordings_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'recordings');

DROP POLICY IF EXISTS "recordings_delete" ON storage.objects;
CREATE POLICY "recordings_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'recordings' AND (SELECT is_admin()));

-- ============================================================
-- 10. AI SUMMARY NOTES — add note_type and source_id columns
-- ============================================================

-- Add note_type to client_notes (manual | transcript_summary | recommendation_summary)
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'manual';
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS source_id text DEFAULT NULL;

-- Add note_type to lead_notes
ALTER TABLE lead_notes ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'manual';
ALTER TABLE lead_notes ADD COLUMN IF NOT EXISTS source_id text DEFAULT NULL;

-- ============================================================
-- DONE! All migrations and RLS policies applied.
-- ============================================================
