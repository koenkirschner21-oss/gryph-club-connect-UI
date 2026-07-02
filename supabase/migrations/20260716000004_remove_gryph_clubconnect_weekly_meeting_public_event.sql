-- Batch 4: Remove completed public "Weekly meeting" test event from Gryph ClubConnect.
-- Scope: one past public weekly-meeting event only; no other club events.
-- Cleans up RSVPs (cascade), form Q&A (cascade), reviews/feedback (cascade),
-- linked tasks, notifications/inbox references, and recurring child instances.

DO $$
DECLARE
  target_club_name constant text := 'Gryph ClubConnect';
  target_title_pattern constant text := 'weekly meeting%';
  v_club_id uuid;
  v_event_id uuid;
  v_delete_ids uuid[];
  v_deleted_children integer := 0;
  v_deleted_notifications integer := 0;
  v_deleted_inbox integer := 0;
  v_deleted_tasks integer := 0;
  v_deleted_events integer := 0;
BEGIN
  SELECT c.id
  INTO v_club_id
  FROM public.clubs AS c
  WHERE lower(trim(c.name)) = lower(target_club_name)
  LIMIT 1;

  IF v_club_id IS NULL THEN
    RAISE NOTICE 'Club "%" not found; skipping weekly meeting event cleanup.', target_club_name;
    RETURN;
  END IF;

  SELECT e.id
  INTO v_event_id
  FROM public.events AS e
  WHERE e.club_id = v_club_id
    AND lower(trim(e.title)) LIKE target_title_pattern
    AND e.visibility = 'public'
    AND e.date < CURRENT_DATE
  ORDER BY e.date ASC
  LIMIT 1;

  IF v_event_id IS NULL THEN
    RAISE NOTICE 'No past public weekly meeting event found for %; skipping.', target_club_name;
    RETURN;
  END IF;

  IF (
    SELECT count(*)
    FROM public.events AS e
    WHERE e.club_id = v_club_id
      AND lower(trim(e.title)) LIKE target_title_pattern
      AND e.visibility = 'public'
      AND e.date < CURRENT_DATE
  ) > 1 THEN
    RAISE EXCEPTION 'Multiple past public weekly meeting events matched; refusing ambiguous delete.';
  END IF;

  SELECT array_agg(e.id)
  INTO v_delete_ids
  FROM public.events AS e
  WHERE e.club_id = v_club_id
    AND (e.id = v_event_id OR e.parent_event_id = v_event_id);

  DELETE FROM public.notifications AS n
  WHERE n.reference_id = ANY (v_delete_ids)
     OR (
       n.club_id = v_club_id
       AND n.type IN ('new_event', 'event')
       AND n.reference_id = ANY (v_delete_ids)
     );
  GET DIAGNOSTICS v_deleted_notifications = ROW_COUNT;

  DELETE FROM public.inbox_messages AS im
  WHERE im.reference_id = ANY (v_delete_ids)
     OR (
       im.club_id = v_club_id
       AND im.reference_id = ANY (v_delete_ids)
     );
  GET DIAGNOSTICS v_deleted_inbox = ROW_COUNT;

  DELETE FROM public.tasks AS t
  WHERE t.club_id = v_club_id
    AND t.linked_event_id = ANY (v_delete_ids);
  GET DIAGNOSTICS v_deleted_tasks = ROW_COUNT;

  DELETE FROM public.events AS e
  WHERE e.id = ANY (v_delete_ids)
    AND e.parent_event_id IS NOT NULL;
  GET DIAGNOSTICS v_deleted_children = ROW_COUNT;

  DELETE FROM public.events AS e
  WHERE e.id = v_event_id;
  GET DIAGNOSTICS v_deleted_events = ROW_COUNT;

  RAISE NOTICE
    'Removed Gryph ClubConnect weekly meeting event %: % parent event(s), % child instance(s), % notifications, % inbox rows, % linked tasks.',
    v_event_id,
    v_deleted_events,
    v_deleted_children,
    v_deleted_notifications,
    v_deleted_inbox,
    v_deleted_tasks;
END;
$$;
