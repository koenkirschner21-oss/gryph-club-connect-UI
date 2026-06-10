ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_join_type_check;

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS membership_type text NOT NULL DEFAULT 'open';

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_membership_type_check;

ALTER TABLE public.clubs ADD CONSTRAINT clubs_membership_type_check
  CHECK (membership_type IN ('open', 'approval_required', 'invite_only', 'no_membership'));

UPDATE public.clubs
SET membership_type = CASE
  WHEN join_type = 'open' AND requires_approval = false THEN 'open'
  WHEN join_type = 'application' OR requires_approval = true THEN 'approval_required'
  WHEN join_type = 'vote' THEN 'invite_only'
  ELSE 'open'
END;
