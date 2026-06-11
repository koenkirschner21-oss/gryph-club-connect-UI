ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS join_questions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS join_answers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS join_message text;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS allow_join_file_upload boolean NOT NULL DEFAULT false;
