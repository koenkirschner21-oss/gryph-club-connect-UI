-- Applicant selects a proposed interview time from an interview invite.

CREATE OR REPLACE FUNCTION public.select_hiring_interview_time(
  p_application_id uuid,
  p_selected_time text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_application public.hiring_applications%ROWTYPE;
  v_selected text := NULLIF(btrim(p_selected_time), '');
  v_time_allowed boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'application_id_required';
  END IF;

  IF v_selected IS NULL THEN
    RAISE EXCEPTION 'selected_time_required';
  END IF;

  SELECT *
  INTO v_application
  FROM public.hiring_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  IF v_application.applicant_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'not_applicant';
  END IF;

  IF v_application.sub_status IS DISTINCT FROM 'interview_invite_sent' THEN
    RAISE EXCEPTION 'interview_not_pending';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(v_application.interview_times, '[]'::jsonb)) AS slot(value)
    WHERE btrim(slot.value) = v_selected
  )
  INTO v_time_allowed;

  IF NOT v_time_allowed THEN
    RAISE EXCEPTION 'selected_time_not_allowed';
  END IF;

  UPDATE public.hiring_applications
  SET
    selected_interview_time = v_selected,
    sub_status = 'interview_scheduled'
  WHERE id = v_application.id;

  UPDATE public.inbox_messages
  SET
    action_completed = true,
    read = true
  WHERE recipient_id = v_user_id
    AND action_type = 'select_interview_time'
    AND reference_id = v_application.id
    AND reference_type = 'hiring_application'
    AND action_completed IS DISTINCT FROM true;

  RETURN jsonb_build_object(
    'outcome', 'scheduled',
    'application_id', v_application.id,
    'selected_interview_time', v_selected
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.select_hiring_interview_time(uuid, text) TO authenticated;
