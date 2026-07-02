-- Batch 3: Remove three old test/dev past meetings from Gryph ClubConnect.
-- Keep: Weekly exec meeting — Sun, Jun 21, 2026, 6:00 PM ET.
-- Delete: Weekly exec (Jun 14, Jun 20), Test 1 (Jun 17, non-cancelled).
-- Preserves upcoming/recurring meetings and the Jun 21 weekly exec meeting.
-- Cleans up meeting-only children: action items (cascade), linked tasks, prep checklist rows.

DO $$
DECLARE
  target_club_name constant text := 'Gryph ClubConnect';
  keep_title constant text := 'Weekly exec meeting';
  keep_date_et constant date := '2026-06-21';
  v_club_id uuid;
  v_keep_id uuid;
  v_delete_ids uuid[];
  v_deleted_prep integer := 0;
  v_deleted_tasks integer := 0;
  v_deleted_action_tasks integer := 0;
  v_deleted_meetings integer := 0;
BEGIN
  SELECT c.id
  INTO v_club_id
  FROM public.clubs AS c
  WHERE lower(trim(c.name)) = lower(target_club_name)
  LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE NOTICE 'Club "%" not found; skipping past meeting cleanup.', target_club_name;
    RETURN;
  END IF;

  SELECT cm.id
  INTO v_keep_id
  FROM public.club_meetings AS cm
  WHERE cm.club_id = v_club_id
    AND lower(trim(cm.title)) = lower(keep_title)
    AND (cm.date AT TIME ZONE 'America/Toronto')::date = keep_date_et
  LIMIT 1;

  IF v_keep_id IS NULL THEN
    RAISE EXCEPTION 'Protected meeting "%" on % not found for %.',
      keep_title,
      keep_date_et,
      target_club_name;
  END IF;

  SELECT array_agg(cm.id ORDER BY cm.date)
  INTO v_delete_ids
  FROM public.club_meetings AS cm
  WHERE cm.club_id = v_club_id
    AND cm.id <> v_keep_id
    AND (
      (
        lower(trim(cm.title)) = lower('Weekly exec')
        AND (cm.date AT TIME ZONE 'America/Toronto')::date IN ('2026-06-14'::date, '2026-06-20'::date)
      )
      OR (
        lower(trim(cm.title)) = lower('Test 1')
        AND cm.status IS DISTINCT FROM 'cancelled'
        AND (cm.date AT TIME ZONE 'America/Toronto')::date = '2026-06-17'::date
      )
    );

  IF v_delete_ids IS NULL OR cardinality(v_delete_ids) = 0 THEN
    RAISE NOTICE 'No Gryph ClubConnect past test meetings matched for deletion.';
    RETURN;
  END IF;

  IF v_keep_id = ANY (v_delete_ids) THEN
    RAISE EXCEPTION 'Refusing to delete protected Jun 21 weekly exec meeting.';
  END IF;

  DELETE FROM public.meeting_prep_items AS mpi
  WHERE mpi.club_id = v_club_id
    AND EXISTS (
      SELECT 1
      FROM unnest(v_delete_ids) AS deleted_id(id)
      WHERE mpi.meeting_key = deleted_id::text
         OR mpi.meeting_key LIKE deleted_id::text || ':%'
    );
  GET DIAGNOSTICS v_deleted_prep = ROW_COUNT;

  DELETE FROM public.tasks AS t
  WHERE t.club_id = v_club_id
    AND t.linked_meeting_id = ANY (v_delete_ids);
  GET DIAGNOSTICS v_deleted_tasks = ROW_COUNT;

  DELETE FROM public.tasks AS t
  WHERE t.id IN (
    SELECT mai.linked_task_id
    FROM public.meeting_action_items AS mai
    WHERE mai.meeting_id = ANY (v_delete_ids)
      AND mai.linked_task_id IS NOT NULL
  );
  GET DIAGNOSTICS v_deleted_action_tasks = ROW_COUNT;

  DELETE FROM public.club_meetings AS cm
  WHERE cm.id = ANY (v_delete_ids);
  GET DIAGNOSTICS v_deleted_meetings = ROW_COUNT;

  RAISE NOTICE
    'Gryph ClubConnect meeting cleanup: deleted % meetings, % linked tasks, % action-item tasks, % prep rows. Kept %.',
    v_deleted_meetings,
    v_deleted_tasks,
    v_deleted_action_tasks,
    v_deleted_prep,
    v_keep_id;
END;
$$;
