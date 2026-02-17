-- ============================================================
-- FIX: Add missing receipt_url column to expenses table
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add receipt_url column (IF NOT EXISTS prevents errors if already there)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text DEFAULT NULL;

-- 2. Create receipts storage bucket (ON CONFLICT prevents duplicate errors)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies (drop first to avoid "already exists" errors)
DROP POLICY IF EXISTS "receipts_auth_upload" ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "receipts_auth_delete" ON storage.objects;

CREATE POLICY "receipts_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');

-- 4. Verify column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'receipt_url';
