-- Commitment fields for club hiring listings (requirements already on club_positions)

ALTER TABLE public.club_positions ADD COLUMN IF NOT EXISTS commitment_level text DEFAULT 'flexible'
  CHECK (commitment_level IN ('flexible', 'part_time', 'weekly_hours'));

ALTER TABLE public.club_positions ADD COLUMN IF NOT EXISTS weekly_hours integer;
