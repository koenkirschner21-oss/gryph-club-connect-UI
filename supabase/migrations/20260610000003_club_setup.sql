ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

UPDATE public.clubs
SET setup_completed = true,
    is_published = true
WHERE claim_status = 'active';
