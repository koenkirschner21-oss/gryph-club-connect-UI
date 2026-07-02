-- Batch 1: Reset accidental owned/claimed state on four archived imported clubs.
-- Scope: only the four named clubs; never touch the six main mock clubs.
-- Ownership/membership reset for kkirschn@uoguelph.ca only — no events/tasks/docs changes.

DO $$
DECLARE
  target_email constant text := 'kkirschn@uoguelph.ca';
  target_user_id uuid;
  protected_names constant text[] := ARRAY[
    'Gryph ClubConnect',
    'Guelph Ramen Club',
    'Gryphon Lego Builders Club',
    'Gryphon Study Café Club',
    'Guelph Outdoor Adventure Club',
    'Guelph Film and Photography Club',
    'Guelph Thrift & Style Club'
  ];
  reset_names constant text[] := ARRAY[
    'Accounting Students'' Association',
    'Achieve Connect Empower',
    'Albanian Students Club',
    'Anime Club Genshiken'
  ];
  reset_club_ids uuid[];
  removed_memberships integer := 0;
  removed_claims integer := 0;
  updated_clubs integer := 0;
BEGIN
  SELECT p.id
  INTO target_user_id
  FROM public.profiles p
  WHERE lower(trim(p.email)) = target_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    SELECT u.id
    INTO target_user_id
    FROM auth.users u
    WHERE lower(trim(u.email)) = target_email
    LIMIT 1;
  END IF;

  SELECT array_agg(c.id ORDER BY c.name)
  INTO reset_club_ids
  FROM public.clubs c
  WHERE c.name = ANY(reset_names)
    AND NOT (c.name = ANY(protected_names));

  IF reset_club_ids IS NULL OR cardinality(reset_club_ids) = 0 THEN
    RAISE NOTICE 'reset_archived_imported_club_claim_state: no target clubs found; no-op';
    RETURN;
  END IF;

  IF cardinality(reset_club_ids) <> cardinality(reset_names) THEN
    RAISE WARNING
      'reset_archived_imported_club_claim_state: expected % clubs, matched %',
      cardinality(reset_names),
      cardinality(reset_club_ids);
  END IF;

  IF target_user_id IS NOT NULL THEN
    DELETE FROM public.club_members cm
    WHERE cm.user_id = target_user_id
      AND cm.club_id = ANY(reset_club_ids);
    GET DIAGNOSTICS removed_memberships = ROW_COUNT;

    DELETE FROM public.club_claim_requests ccr
    WHERE ccr.submitted_by = target_user_id
      AND ccr.club_id = ANY(reset_club_ids);
    GET DIAGNOSTICS removed_claims = ROW_COUNT;

    UPDATE public.clubs c
    SET created_by = NULL
    WHERE c.id = ANY(reset_club_ids)
      AND c.created_by = target_user_id
      AND NOT (c.name = ANY(protected_names));
  ELSE
    RAISE NOTICE
      'reset_archived_imported_club_claim_state: user % not found; skipping membership cleanup',
      target_email;
  END IF;

  UPDATE public.clubs c
  SET claim_status = 'unclaimed'
  WHERE c.id = ANY(reset_club_ids)
    AND c.name = ANY(reset_names)
    AND NOT (c.name = ANY(protected_names))
    AND NOT EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = c.id
        AND cm.role = 'owner'
        AND cm.status = 'active'
    );
  GET DIAGNOSTICS updated_clubs = ROW_COUNT;

  RAISE NOTICE
    'reset_archived_imported_club_claim_state: clubs=%, memberships_removed=%, claim_requests_removed=%, clubs_unclaimed=%',
    cardinality(reset_club_ids),
    removed_memberships,
    removed_claims,
    updated_clubs;
END $$;
