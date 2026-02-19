-- Add public_url column to strategy_plans for shareable animated pages
ALTER TABLE strategy_plans ADD COLUMN IF NOT EXISTS public_url TEXT;

-- Create strategy-pages storage bucket (public, HTML files, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('strategy-pages', 'strategy-pages', true, 5242880, ARRAY['text/html'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies — public read, authenticated upload/delete
CREATE POLICY "strategy_pages_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'strategy-pages');

CREATE POLICY "strategy_pages_auth_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'strategy-pages');

CREATE POLICY "strategy_pages_auth_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'strategy-pages');

-- RLS policy for strategy plan updates
CREATE POLICY "strategy_plans_update" ON strategy_plans FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
