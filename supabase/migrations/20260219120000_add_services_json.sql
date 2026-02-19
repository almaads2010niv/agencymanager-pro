-- Add services_json column to settings table for persisting service list
ALTER TABLE settings ADD COLUMN IF NOT EXISTS services_json TEXT DEFAULT NULL;
