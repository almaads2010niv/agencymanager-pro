-- ============================================================
-- Ideas Kanban Migration
-- Creates ideas table for per-client idea management
-- Run AFTER supabase-multi-tenant-migration.sql
-- ============================================================

-- 1. Create ideas table
CREATE TABLE IF NOT EXISTS ideas (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  priority text NOT NULL DEFAULT 'medium',
  client_id text DEFAULT NULL REFERENCES clients(client_id) ON DELETE SET NULL,
  lead_id text DEFAULT NULL REFERENCES leads(lead_id) ON DELETE SET NULL,
  category text DEFAULT '',
  tags text DEFAULT '[]',
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  assigned_to uuid DEFAULT NULL,
  due_date timestamptz DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
    REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_ideas_tenant ON ideas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ideas_client ON ideas(client_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_assigned ON ideas(assigned_to);

-- 3. RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ideas_select" ON ideas FOR SELECT
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "ideas_insert" ON ideas FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "ideas_update" ON ideas FOR UPDATE
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE POLICY "ideas_delete" ON ideas FOR DELETE
  TO authenticated
  USING (tenant_id = current_tenant_id() AND (SELECT is_admin()));

-- ============================================================
-- DONE! Ideas table ready with tenant-scoped RLS.
-- ============================================================
