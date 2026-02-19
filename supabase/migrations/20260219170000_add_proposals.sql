-- Animated Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  proposal_name TEXT NOT NULL DEFAULT '',
  proposal_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'rejected')),
  public_url TEXT,
  signature_data JSONB,
  viewed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID,
  CONSTRAINT fk_proposal_lead FOREIGN KEY (lead_id)
    REFERENCES leads(lead_id) ON DELETE CASCADE
);

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_select" ON proposals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "proposals_insert" ON proposals FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "proposals_update" ON proposals FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "proposals_delete" ON proposals FOR DELETE
  TO authenticated USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_proposals_lead ON proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- Storage bucket for proposal HTML pages (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proposal-pages', 'proposal-pages', true, 5242880, ARRAY['text/html'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "proposal_pages_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'proposal-pages');

CREATE POLICY "proposal_pages_auth_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'proposal-pages');

CREATE POLICY "proposal_pages_auth_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'proposal-pages');

CREATE POLICY "proposal_pages_auth_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'proposal-pages');

-- Add proposal template columns to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS proposal_phases_template JSONB;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS proposal_packages_template JSONB;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS proposal_terms_template JSONB;
