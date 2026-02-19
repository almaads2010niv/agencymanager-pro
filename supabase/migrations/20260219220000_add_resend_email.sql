-- Add Resend API key and notification email to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS resend_api_key TEXT DEFAULT NULL;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS notification_email TEXT DEFAULT NULL;
