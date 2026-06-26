-- Fix: during-day activity logging with photos was failing.
-- src/app/activity/page.tsx (submit) and src/app/api/activity/upload-photo/route.ts insert/select/update
-- the column `photo_urls` (text[]), but the live activity_logs table only had `photo_url` (text).
-- The whole feature is built around an array, so add the array column to match the code.
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS photo_urls text[];

-- Backfill from the legacy singular photo_url where present.
UPDATE public.activity_logs
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND (photo_urls IS NULL OR cardinality(photo_urls) = 0);

COMMENT ON COLUMN public.activity_logs.photo_urls IS 'Array of attached photo URLs for a during-day activity log entry (matches activity/page.tsx + upload-photo route)';
