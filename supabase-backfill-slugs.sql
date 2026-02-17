-- Backfill slugs for existing tenants that don't have one
-- Run this ONCE in Supabase SQL Editor

UPDATE tenants
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),  -- Remove non-alphanumeric (keeps Hebrew out)
      '\s+', '-', 'g'                                       -- Spaces to hyphens
    ),
    '-+', '-', 'g'                                           -- Collapse multiple hyphens
  )
)
WHERE slug IS NULL;

-- Fallback: if slug ended up empty (e.g. Hebrew-only names), use tenant id prefix
UPDATE tenants
SET slug = 'agency-' || LEFT(id::text, 8)
WHERE slug IS NULL OR slug = '';

-- Verify results
SELECT id, name, slug FROM tenants;
