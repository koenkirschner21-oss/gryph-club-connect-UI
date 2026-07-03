-- Enforce event visibility tiers at the RLS layer.
-- Public/featured events remain visible to anonymous visitors.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only', 'featured'));

DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "events_select_scoped" ON public.events;
DROP POLICY IF EXISTS "events_select_tenant" ON public.events;
DROP POLICY IF EXISTS "events_select_visibility" ON public.events;

CREATE POLICY "events_select_visibility"
  ON public.events
  FOR SELECT
  TO authenticated, anon
  USING (
    COALESCE(visibility, 'public') IN ('public', 'featured')
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'public') = 'members_only'
      AND public.is_active_club_member(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'public') = 'executives_only'
      AND (
        public.club_member_is_executive_or_above(club_id, auth.uid())
        OR public.club_has_permission(club_id, 'create_events', auth.uid())
        OR public.club_has_permission(club_id, 'manage_events', auth.uid())
      )
    )
  );
