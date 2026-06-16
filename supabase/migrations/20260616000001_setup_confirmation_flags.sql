ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS description_confirmed boolean DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_confirmed boolean DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS banner_confirmed boolean DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS membership_confirmed boolean DEFAULT false;
