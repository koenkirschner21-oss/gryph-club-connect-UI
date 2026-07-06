-- Organizer approve/reject for pending event sign-ups (approval-required events).

CREATE OR REPLACE FUNCTION public.approve_event_signup(p_rsvp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rsvp public.event_rsvps%ROWTYPE;
  v_event public.events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rsvp_id IS NULL THEN
    RAISE EXCEPTION 'rsvp_id_required';
  END IF;

  SELECT *
  INTO v_rsvp
  FROM public.event_rsvps
  WHERE id = p_rsvp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rsvp_not_found';
  END IF;

  SELECT *
  INTO v_event
  FROM public.events
  WHERE id = v_rsvp.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF NOT public.club_has_permission(v_event.club_id, 'manage_events', v_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_rsvp.status <> 'pending' THEN
    RAISE EXCEPTION 'rsvp_not_pending';
  END IF;

  UPDATE public.event_rsvps
  SET status = 'going'
  WHERE id = v_rsvp.id;

  RETURN jsonb_build_object(
    'outcome', 'approved',
    'rsvp_id', v_rsvp.id,
    'event_id', v_event.id,
    'club_id', v_event.club_id,
    'user_id', v_rsvp.user_id,
    'previous_status', v_rsvp.status,
    'status', 'going',
    'event_title', v_event.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_event_signup(p_rsvp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rsvp public.event_rsvps%ROWTYPE;
  v_event public.events%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_rsvp_id IS NULL THEN
    RAISE EXCEPTION 'rsvp_id_required';
  END IF;

  SELECT *
  INTO v_rsvp
  FROM public.event_rsvps
  WHERE id = p_rsvp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rsvp_not_found';
  END IF;

  SELECT *
  INTO v_event
  FROM public.events
  WHERE id = v_rsvp.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  IF NOT public.club_has_permission(v_event.club_id, 'manage_events', v_user_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF v_rsvp.status <> 'pending' THEN
    RAISE EXCEPTION 'rsvp_not_pending';
  END IF;

  UPDATE public.event_rsvps
  SET status = 'not_going'
  WHERE id = v_rsvp.id;

  RETURN jsonb_build_object(
    'outcome', 'rejected',
    'rsvp_id', v_rsvp.id,
    'event_id', v_event.id,
    'club_id', v_event.club_id,
    'user_id', v_rsvp.user_id,
    'previous_status', v_rsvp.status,
    'status', 'not_going',
    'event_title', v_event.title
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_event_signup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_event_signup(uuid) TO authenticated;
