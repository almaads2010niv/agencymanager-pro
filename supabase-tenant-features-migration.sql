-- Tenant Features Migration
-- Run in Supabase SQL Editor (one-time)

-- Add is_active column to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
