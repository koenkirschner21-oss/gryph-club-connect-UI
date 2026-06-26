-- AUDIT-2 verification probes (run as linked DB query).

SELECT 'fn.is_active_club_member' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_active_club_member'
  ) AS ok;

SELECT 'fn.is_club_executive' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_club_executive'
  ) AS ok;

SELECT 'policy.tasks_insert_privileged uses is_club_executive' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'tasks_insert_privileged'
      AND with_check ILIKE '%is_club_executive%'
  ) AS ok;

DO $$
DECLARE
  v_club uuid;
  v_user uuid;
BEGIN
  SELECT club_id, user_id
  INTO v_club, v_user
  FROM public.club_members
  WHERE status = 'active'
  LIMIT 1;

  IF v_club IS NULL THEN
    RAISE EXCEPTION 'AUDIT-2 verify failed: no active club member';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM public.ensure_my_club_chats(v_club);
END $$;

DO $$
DECLARE
  v_club uuid;
  v_user uuid;
  v_task_id uuid;
  v_event_id uuid;
BEGIN
  SELECT club_id, user_id
  INTO v_club, v_user
  FROM public.club_members
  WHERE status = 'active'
    AND role IN ('owner', 'executive', 'admin', 'exec')
  LIMIT 1;

  IF v_club IS NULL THEN
    RAISE EXCEPTION 'AUDIT-2 verify failed: no executive club member';
  END IF;

  IF NOT public.is_club_executive(v_club, v_user) THEN
    RAISE EXCEPTION 'AUDIT-2 verify failed: is_club_executive returned false';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.tasks (
    club_id, title, description, status, priority, created_by
  ) VALUES (
    v_club,
    'AUDIT-2 executive task probe',
    'temporary verification row',
    'todo',
    'medium',
    v_user
  )
  RETURNING id INTO v_task_id;

  INSERT INTO public.events (
    club_id, title, description, date, time, location, created_by, visibility
  ) VALUES (
    v_club,
    'AUDIT-2 executive event probe',
    'temporary verification row',
    CURRENT_DATE,
    'TBD',
    'TBD',
    v_user,
    'members_only'
  )
  RETURNING id INTO v_event_id;

  DELETE FROM public.tasks WHERE id = v_task_id;
  DELETE FROM public.events WHERE id = v_event_id;
END $$;
