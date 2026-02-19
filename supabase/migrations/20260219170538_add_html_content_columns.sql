-- Add html_content column to proposals table for Vercel API route serving
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS html_content TEXT;

-- Add html_content column to strategy_plans table for Vercel API route serving
ALTER TABLE strategy_plans ADD COLUMN IF NOT EXISTS html_content TEXT;
