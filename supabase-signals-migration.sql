-- ============================================================
-- Signals OS Integration Migration
-- Adds signals_personality table for storing personality
-- analysis data received via webhook from Signals OS
-- ============================================================

-- 1. Create signals_personality table
CREATE TABLE IF NOT EXISTS signals_personality (
  id text PRIMARY KEY,
  lead_id text REFERENCES leads(lead_id) ON DELETE CASCADE,
  client_id text DEFAULT NULL REFERENCES clients(client_id) ON DELETE SET NULL,
  UNIQUE(lead_id),
  UNIQUE(client_id),

  -- Signals OS identifiers
  analysis_id text,
  tenant_id text,

  -- Subject info (as received from webhook)
  subject_name text,
  subject_email text,
  subject_phone text,

  -- Personality scores
  scores jsonb NOT NULL DEFAULT '{}',
  primary_archetype text NOT NULL,
  secondary_archetype text NOT NULL,
  confidence_level text NOT NULL DEFAULT 'MEDIUM',
  churn_risk text NOT NULL DEFAULT 'MEDIUM',
  smart_tags jsonb NOT NULL DEFAULT '[]',

  -- AI-generated reports
  user_report text,
  business_report text,

  -- Cheat sheets
  sales_cheat_sheet jsonb NOT NULL DEFAULT '{}',
  retention_cheat_sheet jsonb NOT NULL DEFAULT '{}',

  -- Metadata
  result_url text,
  lang text DEFAULT 'he',
  questionnaire_version text,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_signals_personality_lead_id ON signals_personality(lead_id);
CREATE INDEX IF NOT EXISTS idx_signals_personality_email ON signals_personality(subject_email);
CREATE INDEX IF NOT EXISTS idx_signals_personality_client_id ON signals_personality(client_id);

-- 3. RLS
ALTER TABLE signals_personality ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "signals_personality_select_policy" ON signals_personality
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can delete (admin only enforced in app)
CREATE POLICY "signals_personality_delete_policy" ON signals_personality
  FOR DELETE TO authenticated USING (true);

-- Service role (Edge Functions) can insert/update — bypasses RLS automatically
-- But also allow anon for the webhook endpoint
CREATE POLICY "signals_personality_insert_policy" ON signals_personality
  FOR INSERT WITH CHECK (true);

CREATE POLICY "signals_personality_update_policy" ON signals_personality
  FOR UPDATE USING (true);

-- 4. Add webhook secret to settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings' AND column_name = 'signals_webhook_secret'
  ) THEN
    ALTER TABLE settings ADD COLUMN signals_webhook_secret text DEFAULT NULL;
  END IF;
END $$;

-- 5. Enable realtime for signals_personality
ALTER PUBLICATION supabase_realtime ADD TABLE signals_personality;
