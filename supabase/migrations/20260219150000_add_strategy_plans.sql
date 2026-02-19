-- Strategy Plans table — stores AI-generated strategy & action plan documents
CREATE TABLE IF NOT EXISTS strategy_plans (
  id TEXT PRIMARY KEY,
  client_id TEXT DEFAULT NULL,
  lead_id TEXT DEFAULT NULL,
  entity_name TEXT NOT NULL DEFAULT '',
  plan_data JSONB NOT NULL DEFAULT '{}',
  raw_text TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID,
  CONSTRAINT fk_strategy_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_strategy_lead FOREIGN KEY (lead_id) REFERENCES leads(lead_id) ON DELETE CASCADE
);

ALTER TABLE strategy_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategy_plans_select" ON strategy_plans FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "strategy_plans_insert" ON strategy_plans FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "strategy_plans_delete" ON strategy_plans FOR DELETE
  TO authenticated USING (is_admin());
