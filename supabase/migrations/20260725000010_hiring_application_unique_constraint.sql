-- One application per applicant per listing: dedupe (if any), unique index, atomic apply RPC.

DO $$
DECLARE
  v_group record;
  v_row record;
  v_keep_id uuid;
  v_removed_count integer;
BEGIN
  FOR v_group IN
    SELECT listing_id, applicant_id, count(*)::integer AS row_count
    FROM public.hiring_applications
    GROUP BY listing_id, applicant_id
    HAVING count(*) > 1
    ORDER BY row_count DESC, listing_id, applicant_id
  LOOP
    RAISE NOTICE 'hiring_applications_duplicate_group listing_id=% applicant_id=% row_count=%',
      v_group.listing_id, v_group.applicant_id, v_group.row_count;

    FOR v_row IN
      SELECT
        ha.id,
        ha.status,
        ha.sub_status,
        ha.created_at,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE COALESCE(ha.sub_status, 'submitted')
              WHEN 'offer_accepted' THEN 100
              WHEN 'offer_sent' THEN 90
              WHEN 'interview_completed' THEN 80
              WHEN 'interview_scheduled' THEN 75
              WHEN 'interview_invite_sent' THEN 70
              WHEN 'reviewed' THEN 60
              WHEN 'notes_added' THEN 55
              WHEN 'viewed' THEN 50
              WHEN 'submitted' THEN 40
              WHEN 'offer_declined' THEN 30
              WHEN 'rejected' THEN 20
              WHEN 'withdrawn' THEN 10
              ELSE 0
            END DESC,
            CASE ha.status
              WHEN 'accepted' THEN 4
              WHEN 'reviewed' THEN 3
              WHEN 'pending' THEN 2
              WHEN 'rejected' THEN 1
              ELSE 0
            END DESC,
            ha.created_at DESC
        ) AS rank
      FROM public.hiring_applications AS ha
      WHERE ha.listing_id = v_group.listing_id
        AND ha.applicant_id = v_group.applicant_id
    LOOP
      IF v_row.rank = 1 THEN
        v_keep_id := v_row.id;
        RAISE NOTICE 'hiring_applications_duplicate_kept id=% status=% sub_status=% created_at=%',
          v_row.id, v_row.status, v_row.sub_status, v_row.created_at;
      ELSE
        RAISE NOTICE 'hiring_applications_duplicate_removed id=% status=% sub_status=% created_at=%',
          v_row.id, v_row.status, v_row.sub_status, v_row.created_at;
      END IF;
    END LOOP;

    WITH ranked AS (
      SELECT
        ha.id,
        ROW_NUMBER() OVER (
          ORDER BY
            CASE COALESCE(ha.sub_status, 'submitted')
              WHEN 'offer_accepted' THEN 100
              WHEN 'offer_sent' THEN 90
              WHEN 'interview_completed' THEN 80
              WHEN 'interview_scheduled' THEN 75
              WHEN 'interview_invite_sent' THEN 70
              WHEN 'reviewed' THEN 60
              WHEN 'notes_added' THEN 55
              WHEN 'viewed' THEN 50
              WHEN 'submitted' THEN 40
              WHEN 'offer_declined' THEN 30
              WHEN 'rejected' THEN 20
              WHEN 'withdrawn' THEN 10
              ELSE 0
            END DESC,
            CASE ha.status
              WHEN 'accepted' THEN 4
              WHEN 'reviewed' THEN 3
              WHEN 'pending' THEN 2
              WHEN 'rejected' THEN 1
              ELSE 0
            END DESC,
            ha.created_at DESC
        ) AS rank
      FROM public.hiring_applications AS ha
      WHERE ha.listing_id = v_group.listing_id
        AND ha.applicant_id = v_group.applicant_id
    )
    DELETE FROM public.hiring_applications AS ha
    WHERE ha.id IN (SELECT r.id FROM ranked AS r WHERE r.rank > 1);

    GET DIAGNOSTICS v_removed_count = ROW_COUNT;
    RAISE NOTICE 'hiring_applications_duplicate_resolved listing_id=% applicant_id=% kept_id=% removed_count=%',
      v_group.listing_id, v_group.applicant_id, v_keep_id, v_removed_count;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS hiring_applications_listing_applicant_unique
  ON public.hiring_applications (listing_id, applicant_id);

CREATE OR REPLACE FUNCTION public.apply_to_hiring_listing(
  p_listing_id uuid,
  p_answers jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_listing public.hiring_listings%ROWTYPE;
  v_application_id uuid;
  v_answers jsonb := COALESCE(p_answers, '[]'::jsonb);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing_id_required';
  END IF;

  SELECT *
  INTO v_listing
  FROM public.hiring_listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'listing_not_found';
  END IF;

  IF v_listing.is_open IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'listing_closed';
  END IF;

  IF v_listing.deadline IS NOT NULL AND v_listing.deadline < CURRENT_DATE THEN
    RAISE EXCEPTION 'listing_deadline_passed';
  END IF;

  INSERT INTO public.hiring_applications (
    listing_id,
    applicant_id,
    answers,
    status,
    sub_status
  )
  VALUES (
    p_listing_id,
    v_user_id,
    v_answers,
    'pending',
    'submitted'
  )
  ON CONFLICT (listing_id, applicant_id) DO NOTHING
  RETURNING id INTO v_application_id;

  IF v_application_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'created',
      'application_id', v_application_id
    );
  END IF;

  SELECT ha.id
  INTO v_application_id
  FROM public.hiring_applications AS ha
  WHERE ha.listing_id = p_listing_id
    AND ha.applicant_id = v_user_id;

  RETURN jsonb_build_object(
    'outcome', 'already_applied',
    'application_id', v_application_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_hiring_listing(uuid, jsonb) TO authenticated;
