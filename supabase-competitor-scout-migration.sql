-- ============================================================
-- Competitor Scout Migration
-- Creates competitor_reports table for AI competitor analysis
-- ============================================================
-- Run this in Supabase SQL Editor

-- 1. Create competitor_reports table
CREATE TABLE IF NOT EXISTS competitor_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'client' CHECK (entity_type IN ('client', 'lead')),
  business_name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  analysis JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id),
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 2. Index for fast lookup by entity
CREATE INDEX IF NOT EXISTS idx_competitor_reports_entity
ON competitor_reports(entity_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_competitor_reports_tenant
ON competitor_reports(tenant_id);

-- 3. Enable RLS
ALTER TABLE competitor_reports ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can view their tenant's reports
CREATE POLICY "Users can view own tenant competitor reports"
ON competitor_reports FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- INSERT: authenticated users can create reports
CREATE POLICY "Users can create competitor reports"
ON competitor_reports FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- DELETE: only admins
CREATE POLICY "Admins can delete competitor reports"
ON competitor_reports FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Comment
COMMENT ON TABLE competitor_reports IS 'AI-generated competitor analysis reports per client/lead';

-- Done! After running this:
-- 1. Deploy the competitor-scout Edge Function
-- 2. Deploy updated frontend
