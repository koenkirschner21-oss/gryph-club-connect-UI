-- Track when announcements are edited.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Backfill existing rows so updated_at matches created_at.
UPDATE public.posts
SET updated_at = created_at
WHERE updated_at IS NULL;
