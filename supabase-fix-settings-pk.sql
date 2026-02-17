-- ============================================================
-- FIX: Change settings PK from id to tenant_id
-- The old PK (id integer) conflicts with multi-tenant upsert
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Drop old PK constraint
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;

-- 2. Drop the id column entirely (no longer needed)
ALTER TABLE settings DROP COLUMN IF EXISTS id;

-- 3. Make tenant_id the new PK (it's already UNIQUE + NOT NULL from previous migration)
ALTER TABLE settings ADD PRIMARY KEY (tenant_id);

-- 4. Add is_salaried column (boolean — שכיר כן/לא)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS is_salaried boolean DEFAULT false;

-- 5. Verify
SELECT tenant_id, agency_name, employee_salary, is_salaried FROM settings;
