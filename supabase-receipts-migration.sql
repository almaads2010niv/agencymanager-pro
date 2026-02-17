-- ============================================================
-- Receipts Migration
-- Adds receipt_url column to expenses and creates storage bucket
-- ============================================================

-- 1. Add receipt_url column to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url text DEFAULT NULL;

-- 2. Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies for receipts bucket
CREATE POLICY "receipts_auth_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "receipts_auth_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "receipts_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts');

-- NOTE: expenses table already has RLS enabled with policies from
-- supabase-migrations.sql (expenses_select, expenses_insert, etc.)
-- No additional RLS changes needed here.
