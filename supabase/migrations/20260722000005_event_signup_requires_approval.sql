-- Approval-required event sign-ups: pending RSVP status + event flag.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS signup_requires_approval boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.signup_requires_approval IS
  'When true, RSVPs are stored as pending until an organizer approves them.';

ALTER TABLE public.event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_status_check;

ALTER TABLE public.event_rsvps
  ADD CONSTRAINT event_rsvps_status_check
  CHECK (status IN ('going', 'maybe', 'not_going', 'pending'));
