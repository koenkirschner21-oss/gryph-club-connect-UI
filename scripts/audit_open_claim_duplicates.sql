-- Pre-migration audit: clubs with more than one open claim request.
-- Run against production before applying 20260725000003_one_open_claim_request_per_club.sql
--
--   psql "$DATABASE_URL" -f scripts/audit_open_claim_duplicates.sql

\echo '=== Clubs with duplicate open claims (pending / more_info) ==='

SELECT
  club_id,
  count(*)::integer AS open_count
FROM public.club_claim_requests
WHERE status IN ('pending', 'more_info')
GROUP BY club_id
HAVING count(*) > 1
ORDER BY open_count DESC, club_id;

\echo '=== Duplicate open claim rows (detail) ==='

SELECT
  ccr.id,
  ccr.club_id,
  c.name AS club_name,
  ccr.submitted_by,
  ccr.status,
  ccr.created_at
FROM public.club_claim_requests AS ccr
LEFT JOIN public.clubs AS c ON c.id = ccr.club_id
WHERE ccr.status IN ('pending', 'more_info')
  AND ccr.club_id IN (
    SELECT club_id
    FROM public.club_claim_requests
    WHERE status IN ('pending', 'more_info')
    GROUP BY club_id
    HAVING count(*) > 1
  )
ORDER BY ccr.club_id, ccr.created_at ASC, ccr.id ASC;
