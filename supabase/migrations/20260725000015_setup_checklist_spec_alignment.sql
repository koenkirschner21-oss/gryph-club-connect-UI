-- Setup checklist spec: category/meeting location confirmations + optional-item skip tracking.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS category_confirmed boolean DEFAULT false;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS meeting_location_confirmed boolean DEFAULT false;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS content_visibility_defaults_confirmed boolean DEFAULT false;

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS setup_skipped_items jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Clubs imported with values pre-filled should still confirm on first save.
UPDATE public.clubs
SET category_confirmed = true
WHERE NULLIF(btrim(category), '') IS NOT NULL
  AND setup_completed IS TRUE
  AND is_published IS TRUE;

UPDATE public.clubs
SET meeting_location_confirmed = true
WHERE NULLIF(btrim(meeting_location), '') IS NOT NULL
  AND setup_completed IS TRUE
  AND is_published IS TRUE;
