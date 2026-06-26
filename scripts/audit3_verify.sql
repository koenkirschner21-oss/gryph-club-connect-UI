-- AUDIT-3 verification probes (run as linked DB query).

SELECT 'fn.club_has_permission' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'club_has_permission'
  ) AS ok;

SELECT 'policy.tasks_insert_privileged uses club_has_permission' AS check_name,
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tasks'
      AND policyname = 'tasks_insert_privileged'
      AND with_check ILIKE '%club_has_permission%'
  ) AS ok;

SELECT 'hiring_listings.reviewer_ids column' AS check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hiring_listings'
      AND column_name = 'reviewer_ids'
  ) AS ok;

SELECT public.club_default_permission_flag('manage_tasks', 'managerial_executive') AS default_manage_tasks_mgr_exec;

SELECT public.club_resolve_permission_flag(
  '{"assign_tasks":{"managerial_executive":true,"executive":false,"president":true,"member":false}}'::jsonb,
  'manage_tasks',
  'managerial_executive'
) AS custom_manage_tasks_via_assign_alias;

-- Simulated member + managerial_executive task INSERT under RLS (rolled back)
BEGIN;

DO $$
DECLARE
  v_club uuid;
  v_user uuid;
  v_role text;
  v_can boolean;
  v_task_id uuid;
BEGIN
  SELECT cm.club_id, cm.user_id
  INTO v_club, v_user
  FROM public.club_members AS cm
  WHERE cm.status = 'active'
  ORDER BY cm.joined_at NULLS LAST
  LIMIT 1;

  IF v_club IS NULL THEN
    RAISE EXCEPTION 'AUDIT-3 verify failed: no active members';
  END IF;

  UPDATE public.club_members
  SET access_level = 'managerial_executive', role = 'member'
  WHERE club_id = v_club AND user_id = v_user;

  v_role := public.club_member_permission_role(v_club, v_user);
  IF v_role IS DISTINCT FROM 'managerial_executive' THEN
    RAISE EXCEPTION 'AUDIT-3 verify failed: role resolution got %', v_role;
  END IF;

  v_can := public.club_has_permission(v_club, 'manage_tasks', v_user);
  IF NOT v_can THEN
    RAISE EXCEPTION 'AUDIT-3 verify failed: club_has_permission(manage_tasks) returned false';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  INSERT INTO public.tasks (
    club_id, title, description, status, priority, created_by
  ) VALUES (
    v_club,
    'AUDIT-3 simulated mgr exec task probe',
    'transaction rolled back',
    'todo',
    'medium',
    v_user
  )
  RETURNING id INTO v_task_id;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'AUDIT-3 verify failed: task insert returned null id';
  END IF;
END $$;

ROLLBACK;
