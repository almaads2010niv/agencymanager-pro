-- ============================================================
-- PDF Branding Migration
-- Adds logo storage + brand color palette to settings
-- ============================================================
-- Run this in Supabase SQL Editor

-- 1. Add branding columns to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS logo_storage_path TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#14b8a6',
ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#0f766e',
ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#f59e0b';

-- 2. Create logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Logos bucket RLS policies
-- Anyone authenticated can view logos (public bucket for PDF embedding)
CREATE POLICY "Authenticated users can view logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'logos');

-- Only admins can upload logos
CREATE POLICY "Admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Only admins can delete logos
CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- 4. Comments
COMMENT ON COLUMN settings.logo_storage_path IS 'Path in logos bucket for tenant logo (used in PDF documents)';
COMMENT ON COLUMN settings.brand_primary_color IS 'Primary brand color hex for PDF documents (default: teal #14b8a6)';
COMMENT ON COLUMN settings.brand_secondary_color IS 'Secondary brand color hex for PDF documents (default: dark teal #0f766e)';
COMMENT ON COLUMN settings.brand_accent_color IS 'Accent brand color hex for PDF documents (default: amber #f59e0b)';

-- Done! After running this:
-- 1. Deploy updated frontend (includes pdfGenerator + Settings branding UI)
-- 2. Users can upload logos and pick colors from Settings
