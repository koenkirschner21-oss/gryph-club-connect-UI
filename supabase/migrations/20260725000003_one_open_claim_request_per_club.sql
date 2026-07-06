-- Enforce at most one open (pending / more_info) claim request per club.
-- Resolves any existing duplicates before creating the partial unique index.

DO $$
DECLARE
  v_duplicate_club record;
  v_row record;
  v_canceled_ids uuid[] := ARRAY[]::uuid[];
  v_canceled_count integer := 0;
BEGIN
  FOR v_duplicate_club IN
    SELECT
      club_id,
      count(*)::integer AS open_count
    FROM public.club_claim_requests
    WHERE status IN ('pending', 'more_info')
    GROUP BY club_id
    HAVING count(*) > 1
    ORDER BY club_id
  LOOP
    RAISE NOTICE
      'open_claim_duplicate club_id=% open_count=%',
      v_duplicate_club.club_id,
      v_duplicate_club.open_count;
  END LOOP;

  FOR v_row IN
    WITH ranked AS (
      SELECT
        id,
        club_id,
        status,
        created_at,
        row_number() OVER (
          PARTITION BY club_id
          ORDER BY created_at ASC, id ASC
        ) AS rn
      FROM public.club_claim_requests
      WHERE status IN ('pending', 'more_info')
    )
    SELECT id, club_id, status, created_at
    FROM ranked
    WHERE rn > 1
    ORDER BY club_id, created_at ASC, id ASC
  LOOP
    UPDATE public.club_claim_requests
    SET status = 'canceled'
    WHERE id = v_row.id;

    v_canceled_ids := array_append(v_canceled_ids, v_row.id);
    v_canceled_count := v_canceled_count + 1;

    RAISE NOTICE
      'open_claim_duplicate_resolved canceled_request_id=% club_id=% status=% created_at=%',
      v_row.id,
      v_row.club_id,
      v_row.status,
      v_row.created_at;
  END LOOP;

  IF v_canceled_count > 0 THEN
    RAISE NOTICE
      'open_claim_duplicate_resolved total_canceled=% ids=%',
      v_canceled_count,
      v_canceled_ids;
  ELSE
    RAISE NOTICE 'open_claim_duplicate_resolved none';
  END IF;

  WITH reconciled AS (
    UPDATE public.clubs AS c
    SET claim_status = 'unclaimed'
    WHERE c.claim_status = 'claim_pending'
      AND NOT EXISTS (
        SELECT 1
        FROM public.club_claim_requests AS ccr
        WHERE ccr.club_id = c.id
          AND ccr.status IN ('pending', 'more_info')
      )
    RETURNING c.id
  )
  SELECT count(*)::integer
  INTO v_canceled_count
  FROM reconciled;

  IF v_canceled_count > 0 THEN
    RAISE NOTICE
      'open_claim_duplicate_reconciled clubs_reset_to_unclaimed=%',
      v_canceled_count;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS club_claim_requests_one_open_per_club_uidx
  ON public.club_claim_requests (club_id)
  WHERE status IN ('pending', 'more_info');
