-- =============================================================================
-- Harden SELECT RLS policies for tenant isolation
-- =============================================================================
-- Replaces broad read policies with membership-scoped reads.
-- =============================================================================

-- =====================
-- club_members
-- =====================
DROP POLICY IF EXISTS "Anyone can view club members" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_policy" ON public.club_members;
DROP POLICY IF EXISTS "club_members_select_scoped" ON public.club_members;

CREATE POLICY "club_members_select_scoped"
  ON public.club_members
  FOR SELECT
  USING (
    club_id IN (
      SELECT cm.club_id
      FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- =====================
-- events
-- =====================
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
DROP POLICY IF EXISTS "events_select_scoped" ON public.events;

CREATE POLICY "events_select_scoped"
  ON public.events
  FOR SELECT
  USING (
    club_id IN (
      SELECT club_members.club_id
      FROM public.club_members
      WHERE club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- =====================
-- event_rsvps
-- =====================
DROP POLICY IF EXISTS "Anyone can view RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_select_policy" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_select_scoped" ON public.event_rsvps;

CREATE POLICY "event_rsvps_select_scoped"
  ON public.event_rsvps
  FOR SELECT
  USING (
    event_id IN (
      SELECT events.id
      FROM public.events
      WHERE events.club_id IN (
        SELECT club_members.club_id
        FROM public.club_members
        WHERE club_members.user_id = auth.uid()
          AND club_members.status = 'active'
      )
    )
  );

-- =====================
-- profiles
-- =====================
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;

CREATE POLICY "profiles_select_scoped"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT club_members.user_id
      FROM public.club_members
      WHERE club_members.club_id IN (
        SELECT cm.club_id
        FROM public.club_members AS cm
        WHERE cm.user_id = auth.uid()
          AND cm.status = 'active'
      )
    )
  );
