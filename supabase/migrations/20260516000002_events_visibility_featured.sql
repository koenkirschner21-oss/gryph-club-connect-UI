-- Add 'featured' visibility tier for campus home promotion

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'featured'));

COMMENT ON COLUMN public.events.visibility IS
  'members_only: club members; public: open attendance, not on campus feed; featured: home page promotion';

DROP POLICY IF EXISTS "events_select_visibility" ON public.events;

CREATE POLICY "events_select_visibility"
  ON public.events
  FOR SELECT
  TO authenticated, anon
  USING (
    visibility IN ('public', 'featured')
    OR (
      auth.uid() IS NOT NULL
      AND club_id IN (
        SELECT cm.club_id
        FROM public.club_members AS cm
        WHERE cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
    )
  );
