-- Post-event internal reviews (exec-only) and anonymous member feedback.

CREATE TABLE IF NOT EXISTS public.event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  went_well text NOT NULL DEFAULT '',
  needs_improvement text NOT NULL DEFAULT '',
  issues text NOT NULL DEFAULT '',
  attendance_summary text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  follow_up_tasks text NOT NULL DEFAULT '',
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'complete')),
  feedback_form_enabled boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_reviews_event_id_key UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.event_feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  overall_rating smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  engagement_rating smallint NOT NULL CHECK (engagement_rating BETWEEN 1 AND 5),
  organization_rating smallint NOT NULL CHECK (organization_rating BETWEEN 1 AND 5),
  liked text NOT NULL DEFAULT '',
  improve text NOT NULL DEFAULT '',
  would_attend_again boolean,
  other_feedback text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_reviews_club_id_idx ON public.event_reviews (club_id);
CREATE INDEX IF NOT EXISTS event_feedback_responses_event_id_idx
  ON public.event_feedback_responses (event_id);

ALTER TABLE public.event_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_feedback_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_reviews_select_exec" ON public.event_reviews;
CREATE POLICY "event_reviews_select_exec"
  ON public.event_reviews
  FOR SELECT
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
  );

DROP POLICY IF EXISTS "event_reviews_insert_exec" ON public.event_reviews;
CREATE POLICY "event_reviews_insert_exec"
  ON public.event_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
  );

DROP POLICY IF EXISTS "event_reviews_update_exec" ON public.event_reviews;
CREATE POLICY "event_reviews_update_exec"
  ON public.event_reviews
  FOR UPDATE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
  )
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
  );

DROP POLICY IF EXISTS "event_feedback_insert_member" ON public.event_feedback_responses;
CREATE POLICY "event_feedback_insert_member"
  ON public.event_feedback_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_club_member(club_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.event_reviews AS er
      WHERE er.event_id = event_feedback_responses.event_id
        AND er.feedback_form_enabled = true
    )
  );

DROP POLICY IF EXISTS "event_feedback_select_exec" ON public.event_feedback_responses;
CREATE POLICY "event_feedback_select_exec"
  ON public.event_feedback_responses
  FOR SELECT
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_events', auth.uid())
  );

COMMENT ON TABLE public.event_feedback_responses IS
  'Anonymous member feedback; intentionally has no user_id column.';

CREATE OR REPLACE FUNCTION public.event_feedback_form_enabled(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT er.feedback_form_enabled
      FROM public.event_reviews AS er
      WHERE er.event_id = p_event_id
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.event_feedback_form_enabled(uuid) TO authenticated;
