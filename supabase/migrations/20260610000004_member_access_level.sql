ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS access_level text
  CHECK (access_level IN ('president', 'managerial_executive', 'executive', 'member'));

UPDATE public.club_members
SET access_level = CASE
  WHEN role = 'owner' THEN 'president'
  WHEN role = 'executive' THEN 'executive'
  ELSE 'member'
END
WHERE access_level IS NULL;
