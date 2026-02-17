-- ============================================================
-- Knowledge Base Migration
-- Creates knowledge_articles table + storage bucket
-- Run AFTER supabase-multi-tenant-migration.sql
-- ============================================================

-- 1. Create knowledge_articles table
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text DEFAULT '',
  summary text DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  tags text DEFAULT '[]',
  file_url text DEFAULT NULL,
  file_name text DEFAULT NULL,
  file_type text DEFAULT NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant ON knowledge_articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_search
  ON knowledge_articles USING gin(to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, '')));

-- 3. RLS
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_articles_select" ON knowledge_articles FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "knowledge_articles_insert" ON knowledge_articles FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "knowledge_articles_update" ON knowledge_articles FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

CREATE POLICY "knowledge_articles_delete" ON knowledge_articles FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- 4. Storage bucket for knowledge base documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('knowledge', 'knowledge', false, 20971520,
  ARRAY['application/pdf', 'text/plain', 'text/markdown',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "knowledge_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge');

CREATE POLICY "knowledge_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge');

CREATE POLICY "knowledge_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge' AND (SELECT is_admin()));

-- ============================================================
-- DONE! Knowledge base table + storage bucket ready.
-- ============================================================
