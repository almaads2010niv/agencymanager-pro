-- ============================================================
-- AI Notebook Migration
-- Context-aware AI chat per client/lead
-- ============================================================
-- Run this in Supabase SQL Editor

-- 1. Create ai_notebook_messages table
CREATE TABLE IF NOT EXISTS ai_notebook_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'client' CHECK (entity_type IN ('client', 'lead')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_notebook_entity
ON ai_notebook_messages(entity_id, entity_type, created_at);

CREATE INDEX IF NOT EXISTS idx_notebook_tenant
ON ai_notebook_messages(tenant_id);

-- 3. Enable RLS
ALTER TABLE ai_notebook_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant notebook messages"
ON ai_notebook_messages FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create notebook messages"
ON ai_notebook_messages FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can delete notebook messages"
ON ai_notebook_messages FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

COMMENT ON TABLE ai_notebook_messages IS 'AI Notebook: context-aware chat per client/lead with CRM data context';
