-- ============================================================
-- Calendar Events Migration
-- Adds calendar_events table for scheduling calls, meetings,
-- tasks, and reminders linked to clients/leads
-- ============================================================

-- 1. Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id text PRIMARY KEY,
  title text NOT NULL,
  event_type text NOT NULL DEFAULT 'task',
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  description text DEFAULT '',
  client_id text DEFAULT NULL REFERENCES clients(client_id) ON DELETE SET NULL,
  lead_id text DEFAULT NULL REFERENCES leads(lead_id) ON DELETE SET NULL,
  created_by text NOT NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead_id ON calendar_events(lead_id);

-- 3. RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all events
CREATE POLICY "calendar_events_select_policy" ON calendar_events
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert events
CREATE POLICY "calendar_events_insert_policy" ON calendar_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update events
CREATE POLICY "calendar_events_update_policy" ON calendar_events
  FOR UPDATE TO authenticated USING (true);

-- Authenticated users can delete events
CREATE POLICY "calendar_events_delete_policy" ON calendar_events
  FOR DELETE TO authenticated USING (true);

-- 4. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
