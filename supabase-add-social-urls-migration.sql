-- Migration: Add social media / website URL fields to clients and leads
-- Run this in Supabase SQL Editor

-- Add to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL;

-- Add to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_url TEXT DEFAULT NULL;
