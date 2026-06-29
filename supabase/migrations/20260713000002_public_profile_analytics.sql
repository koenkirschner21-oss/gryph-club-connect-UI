-- Lightweight public profile view/click analytics.

CREATE TABLE IF NOT EXISTS public.club_public_profile_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'page_view',
      'join_click',
      'join_request',
      'event_click',
      'hiring_click',
      'save_click'
    )
  ),
  target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_public_profile_events_club_created
  ON public.club_public_profile_events (club_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_club_public_profile_events_club_type
  ON public.club_public_profile_events (club_id, event_type);

ALTER TABLE public.club_public_profile_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_public_profile_events_insert" ON public.club_public_profile_events;
CREATE POLICY "club_public_profile_events_insert"
  ON public.club_public_profile_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.clubs AS c
      WHERE c.id = club_public_profile_events.club_id
    )
  );

DROP POLICY IF EXISTS "club_public_profile_events_select_analytics" ON public.club_public_profile_events;
CREATE POLICY "club_public_profile_events_select_analytics"
  ON public.club_public_profile_events
  FOR SELECT
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'view_analytics', auth.uid())
  );

-- Saved/followed count for public profile analytics section.
DROP POLICY IF EXISTS "user_clubs_select_club_analytics" ON public.user_clubs;
CREATE POLICY "user_clubs_select_club_analytics"
  ON public.user_clubs
  FOR SELECT
  TO authenticated
  USING (
    type = 'saved'
    AND public.club_has_permission(club_id, 'view_analytics', auth.uid())
  );
