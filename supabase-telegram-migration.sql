-- ============================================================
-- Telegram Bot Migration
-- Telegram integration for CRM voice/text/image commands
-- ============================================================
-- Run this in Supabase SQL Editor

-- 1. Add telegram_bot_token to settings
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;

-- 2. Create telegram_messages table for logging
CREATE TABLE IF NOT EXISTS telegram_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'photo', 'document')),
  content TEXT,
  ai_response TEXT,
  action_taken TEXT,
  entity_id UUID,
  entity_type TEXT CHECK (entity_type IN ('client', 'lead', NULL)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES tenants(id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_tenant
ON telegram_messages(tenant_id, created_at DESC);

-- 3. Enable RLS
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant telegram messages"
ON telegram_messages FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- Service role can insert (Edge Function)
CREATE POLICY "Service role can insert telegram messages"
ON telegram_messages FOR INSERT
TO service_role
WITH CHECK (true);

-- Also allow authenticated insert for admin
CREATE POLICY "Admins can manage telegram messages"
ON telegram_messages FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

COMMENT ON TABLE telegram_messages IS 'Telegram bot message log with AI responses';
COMMENT ON COLUMN settings.telegram_bot_token IS 'Telegram Bot API token from BotFather';
COMMENT ON COLUMN settings.telegram_chat_id IS 'Authorized Telegram chat ID for this tenant';
