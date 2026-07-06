-- Tighten overly permissive SELECT policies on event questionnaire / RSVP response tables.
-- Question visibility follows events_select_visibility via an events subquery (RLS on events applies).
-- Response and external RSVP reads are limited to own rows or manage_events for the event's club.

-- ─── event_form_questions ───
DROP POLICY IF EXISTS "Club members can view questions" ON public.event_form_questions;

CREATE POLICY "event_form_questions_select_viewable_event"
  ON public.event_form_questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.events AS e
      WHERE e.id = event_form_questions.event_id
    )
  );

-- ─── event_form_responses ───
DROP POLICY IF EXISTS "Executives can view all responses" ON public.event_form_responses;

CREATE POLICY "event_form_responses_select_manage_events"
  ON public.event_form_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events AS e
      WHERE e.id = event_form_responses.event_id
        AND public.club_has_permission(e.club_id, 'manage_events', auth.uid())
    )
  );

-- "Members can view own responses" remains: auth.uid() = user_id

-- ─── event_external_rsvps ───
DROP POLICY IF EXISTS "Executives can view external RSVPs" ON public.event_external_rsvps;

CREATE POLICY "event_external_rsvps_select_manage_events"
  ON public.event_external_rsvps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events AS e
      WHERE e.id = event_external_rsvps.event_id
        AND public.club_has_permission(e.club_id, 'manage_events', auth.uid())
    )
  );

-- "Anyone can submit external RSVP" INSERT policy is unchanged (guest submission stays open).

-- ─── event_feedback_responses ───
-- event_feedback_select_exec already scopes SELECT to
-- club_has_permission(club_id, 'manage_events', auth.uid()) on each row's club_id.
-- No policy change required.
