ALTER TABLE public.events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

UPDATE public.events
SET visibility = 'public'
WHERE visibility = 'featured';

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only'));

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'members_only';

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_visibility_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only'));

ALTER TABLE public.club_documents ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'members_only';

ALTER TABLE public.club_documents DROP CONSTRAINT IF EXISTS club_documents_visibility_check;
ALTER TABLE public.club_documents ADD CONSTRAINT club_documents_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'is_public'
  ) THEN
    UPDATE public.events
    SET visibility = CASE
      WHEN is_public = true THEN 'public'
      ELSE 'members_only'
    END;
  END IF;
END $$;
