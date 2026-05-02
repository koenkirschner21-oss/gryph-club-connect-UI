-- =============================================================================
-- P0.3 support: track event creator for reliable profile joins from the client
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_creator_profile_fkey'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_creator_profile_fkey
      FOREIGN KEY (created_by)
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins and execs can create events" ON public.events;

CREATE POLICY "Admins and execs can create events"
  ON public.events
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_members.club_id = events.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );
