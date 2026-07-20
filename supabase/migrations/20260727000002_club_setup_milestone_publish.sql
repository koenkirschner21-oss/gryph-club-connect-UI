-- Club setup redesign: meets_regularly + leaner publish blockers.

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS meets_regularly boolean;

COMMENT ON COLUMN public.clubs.meets_regularly IS
  'NULL = unanswered; true = meets regularly (schedule/location required); false = does not meet regularly.';

CREATE OR REPLACE FUNCTION public.publish_club_profile(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_club public.clubs%ROWTYPE;
  v_missing jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'club_id_required';
  END IF;

  SELECT *
  INTO v_club
  FROM public.clubs
  WHERE id = p_club_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'club_not_found';
  END IF;

  IF NOT (
    public.is_club_president(p_club_id, v_user_id)
    OR public.club_has_permission(p_club_id, 'manage_club_settings', v_user_id)
  ) THEN
    RETURN jsonb_build_object(
      'outcome', 'forbidden',
      'error', 'not_authorized'
    );
  END IF;

  IF v_club.setup_completed IS TRUE
    AND v_club.is_published IS TRUE
    AND v_club.claim_status = 'active' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_published',
      'club_id', v_club.id,
      'claim_status', v_club.claim_status,
      'is_published', v_club.is_published,
      'setup_completed', v_club.setup_completed
    );
  END IF;

  IF v_club.claim_status IS DISTINCT FROM 'claimed' THEN
    RETURN jsonb_build_object(
      'outcome', 'invalid_state',
      'error', 'club_not_ready_to_publish',
      'claim_status', v_club.claim_status
    );
  END IF;

  -- Required milestone: Complete Club Profile
  IF NULLIF(btrim(v_club.name), '') IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'name', 'label', 'Club name')
    );
  END IF;

  IF public.is_placeholder_club_image_url(v_club.logo_url) THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'logo', 'label', 'Club logo')
    );
  END IF;

  IF public.is_placeholder_club_image_url(v_club.banner_url) THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'banner', 'label', 'Club banner')
    );
  END IF;

  IF NULLIF(btrim(v_club.short_description), '') IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'short-description', 'label', 'Short description')
    );
  END IF;

  IF NULLIF(btrim(v_club.category), '') IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'category', 'label', 'Category')
    );
  END IF;

  -- Required milestone: Contact and Meeting Details
  IF NULLIF(btrim(v_club.contact_email), '') IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'contact-email', 'label', 'Contact email')
    );
  END IF;

  IF v_club.meets_regularly IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'meets-regularly', 'label', 'Meeting frequency')
    );
  ELSIF v_club.meets_regularly IS TRUE THEN
    IF NULLIF(btrim(v_club.meeting_schedule), '') IS NULL THEN
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('id', 'meeting-schedule', 'label', 'Meeting schedule')
      );
    END IF;
    IF NULLIF(btrim(v_club.meeting_location), '') IS NULL THEN
      v_missing := v_missing || jsonb_build_array(
        jsonb_build_object('id', 'meeting-location', 'label', 'Meeting location')
      );
    END IF;
  END IF;

  -- Required milestone: Membership Rules
  IF v_club.membership_type IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'membership-type', 'label', 'Membership rules')
    );
  END IF;

  IF jsonb_array_length(v_missing) > 0 THEN
    RETURN jsonb_build_object(
      'outcome', 'incomplete',
      'missing_items', v_missing
    );
  END IF;

  UPDATE public.clubs
  SET
    claim_status = 'active',
    is_published = true,
    setup_completed = true,
    -- Keep confirm flags aligned after successful publish.
    logo_confirmed = true,
    banner_confirmed = true,
    description_confirmed = true,
    category_confirmed = true,
    contact_email_confirmed = true,
    membership_confirmed = true,
    meeting_schedule_confirmed = CASE
      WHEN meets_regularly IS TRUE THEN true
      ELSE meeting_schedule_confirmed
    END,
    meeting_location_confirmed = CASE
      WHEN meets_regularly IS TRUE THEN true
      ELSE meeting_location_confirmed
    END
  WHERE id = p_club_id;

  RETURN jsonb_build_object(
    'outcome', 'published',
    'club_id', p_club_id,
    'claim_status', 'active',
    'is_published', true,
    'setup_completed', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_club_profile(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
