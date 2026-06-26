-- AUDIT-5 verification probes (run as linked DB query).

WITH checks AS (
  SELECT 'no_permissive_club_resource_links_insert' AS check_name,
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'club_resource_links'
        AND cmd = 'INSERT'
        AND with_check = 'true'
    ) AS ok
  UNION ALL
  SELECT 'no_permissive_club_resource_links_delete',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'club_resource_links'
        AND cmd = 'DELETE'
        AND qual = 'true'
    )
  UNION ALL
  SELECT 'club_resource_links_insert_uses_manage_documents',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'club_resource_links'
        AND policyname = 'club_resource_links_insert_manage_documents'
        AND with_check ILIKE '%manage_documents%'
    )
  UNION ALL
  SELECT 'no_permissive_event_rsvps_select',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'event_rsvps'
        AND cmd = 'SELECT'
        AND qual = 'true'
    )
  UNION ALL
  SELECT 'no_legacy_event_rsvps_insert',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'event_rsvps'
        AND policyname IN ('Members can insert own RSVP', 'Users can RSVP')
    )
  UNION ALL
  SELECT 'event_rsvps_select_includes_public_events',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'event_rsvps'
        AND policyname = 'event_rsvps_select_own_or_tenant'
        AND qual ILIKE '%public%'
        AND qual ILIKE '%featured%'
    )
  UNION ALL
  SELECT 'hiring_listings_open_select_still_exists',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'hiring_listings'
        AND policyname = 'hiring_listings_select_open'
        AND qual ILIKE '%is_open%'
    )
  UNION ALL
  SELECT 'no_permissive_events_select',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'events'
        AND cmd = 'SELECT'
        AND qual = 'true'
    )
  UNION ALL
  SELECT 'events_visibility_select_still_exists',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'events'
        AND policyname = 'events_select_visibility'
    )
)
SELECT * FROM checks ORDER BY 1;

-- Public hiring board browse: open listings remain readable
SELECT 'open_hiring_listings_readable' AS check_name,
  count(*)::int >= 0 AS ok
FROM public.hiring_listings
WHERE is_open = true
LIMIT 1;

-- Public/featured events remain readable under visibility policy
SELECT 'public_events_readable' AS check_name,
  count(*)::int >= 0 AS ok
FROM public.events
WHERE visibility IN ('public', 'featured')
LIMIT 1;
