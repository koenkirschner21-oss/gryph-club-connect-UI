ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS contact_email_confirmed boolean DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS social_links_confirmed boolean DEFAULT false;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS meeting_schedule_confirmed boolean DEFAULT false;
