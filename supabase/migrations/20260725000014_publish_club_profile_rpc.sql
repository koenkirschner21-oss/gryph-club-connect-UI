-- Atomic club publish with setup checklist validation; tighten clubs_update_privileged RLS.

CREATE OR REPLACE FUNCTION public.is_placeholder_club_image_url(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(btrim(p_url), ''), '') = ''
    OR lower(btrim(p_url)) LIKE '%ui-avatars%'
    OR lower(btrim(p_url)) LIKE '%placeholder%'
    OR lower(btrim(p_url)) LIKE '%default%'
    OR lower(btrim(p_url)) LIKE '%initials%';
$$;

CREATE OR REPLACE FUNCTION public.club_has_social_links(p_links jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_each_text(COALESCE(p_links, '{}'::jsonb)) AS link(key, value)
    WHERE NULLIF(btrim(link.value), '') IS NOT NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.publish_club_profile(p_club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_club public.clubs%ROWTYPE;
  v_posts_count integer := 0;
  v_events_count integer := 0;
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

  SELECT count(*)::integer
  INTO v_posts_count
  FROM public.posts
  WHERE club_id = p_club_id;

  SELECT count(*)::integer
  INTO v_events_count
  FROM public.events
  WHERE club_id = p_club_id;

  -- Mirrors src/components/club/SetupChecklist.tsx buildChecklistItems().
  IF NULLIF(btrim(v_club.name), '') IS NULL THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'name', 'label', 'Club name confirmed')
    );
  END IF;

  IF public.is_placeholder_club_image_url(v_club.logo_url)
    OR v_club.logo_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'logo',
        'label',
        CASE
          WHEN public.is_placeholder_club_image_url(v_club.logo_url) THEN 'Add club logo'
          ELSE 'Confirm club logo'
        END
      )
    );
  END IF;

  IF public.is_placeholder_club_image_url(v_club.banner_url)
    OR v_club.banner_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'banner',
        'label',
        CASE
          WHEN public.is_placeholder_club_image_url(v_club.banner_url) THEN 'Add club banner'
          ELSE 'Confirm club banner'
        END
      )
    );
  END IF;

  IF NULLIF(btrim(v_club.short_description), '') IS NULL
    OR v_club.description_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'short-description',
        'label',
        CASE
          WHEN NULLIF(btrim(v_club.short_description), '') IS NULL THEN 'Add short description'
          ELSE 'Confirm short description'
        END
      )
    );
  END IF;

  IF NULLIF(btrim(v_club.contact_email), '') IS NULL
    OR v_club.contact_email_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'contact-email',
        'label',
        CASE
          WHEN NULLIF(btrim(v_club.contact_email), '') IS NULL THEN 'Add contact email'
          ELSE 'Confirm contact email'
        END
      )
    );
  END IF;

  IF NULLIF(btrim(v_club.meeting_schedule), '') IS NULL
    OR v_club.meeting_schedule_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'meeting-schedule',
        'label',
        CASE
          WHEN NULLIF(btrim(v_club.meeting_schedule), '') IS NULL THEN 'Add meeting schedule'
          ELSE 'Confirm meeting schedule'
        END
      )
    );
  END IF;

  IF NOT public.club_has_social_links(v_club.social_links)
    OR v_club.social_links_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'social-links',
        'label',
        CASE
          WHEN NOT public.club_has_social_links(v_club.social_links) THEN 'Add social links'
          ELSE 'Confirm social links'
        END
      )
    );
  END IF;

  IF v_club.membership_type IS NULL
    OR v_club.membership_confirmed IS DISTINCT FROM true THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object(
        'id', 'membership-type',
        'label',
        CASE
          WHEN v_club.membership_type IS NULL THEN 'Add membership rules'
          ELSE 'Confirm membership rules'
        END
      )
    );
  END IF;

  -- Batch 5 extension point: add category / meeting_location checks here when required.

  IF v_posts_count < 1 THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'announcement', 'label', 'Create welcome announcement')
    );
  END IF;

  IF v_events_count < 1 THEN
    v_missing := v_missing || jsonb_build_array(
      jsonb_build_object('id', 'event', 'label', 'Create first event')
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
    setup_completed = true
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

GRANT EXECUTE ON FUNCTION public.is_placeholder_club_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_has_social_links(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_club_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "clubs_update_privileged" ON public.clubs;
CREATE POLICY "clubs_update_privileged"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.club_has_permission(id, 'manage_club_settings', auth.uid())
    OR public.club_has_permission(id, 'edit_club_settings', auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.club_has_permission(id, 'manage_club_settings', auth.uid())
    OR public.club_has_permission(id, 'edit_club_settings', auth.uid())
  );
