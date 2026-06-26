-- AUDIT-4 verification probes (run as linked DB query).

WITH checks AS (
  SELECT 'trigger.on_club_member_sync_chats' AS check_name,
    EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname = 'on_club_member_sync_chats'
    ) AS ok
  UNION ALL
  SELECT 'trigger.on_club_created_provision_chats',
    EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname = 'on_club_created_provision_chats'
    )
  UNION ALL
  SELECT 'trigger.aaa_ensure_creator_membership',
    EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgname = 'aaa_ensure_creator_membership'
    )
  UNION ALL
  SELECT 'fn.ensure_my_club_chats',
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'ensure_my_club_chats'
    )
  UNION ALL
  SELECT 'is_club_chat_executive_checks_access_level',
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'is_club_chat_executive'
        AND pg_get_functiondef(p.oid) ILIKE '%access_level%'
    )
  UNION ALL
  SELECT 'owners_missing_president_access_level',
    NOT EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.role = 'owner'
        AND cm.status = 'active'
        AND COALESCE(cm.access_level, '') <> 'president'
    )
)
SELECT * FROM checks ORDER BY 1;

-- 1) Join approval auto-provisions General chat (rolled back)
BEGIN;

DO $$
DECLARE
  v_club uuid;
  v_user uuid;
  v_member_id uuid;
  v_general uuid;
  v_in_general boolean;
BEGIN
  SELECT c.id INTO v_club FROM public.clubs c ORDER BY c.created_at DESC LIMIT 1;
  SELECT p.id INTO v_user FROM public.profiles p ORDER BY p.created_at DESC LIMIT 1;

  IF v_club IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'AUDIT-4 verify failed: need club and profile';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role, status)
  VALUES (v_club, v_user, 'member', 'pending')
  ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'pending'
  RETURNING id INTO v_member_id;

  UPDATE public.club_members
  SET status = 'active'
  WHERE id = v_member_id;

  v_general := public.get_club_group_conversation(v_club, 'General');

  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = v_general AND cm.user_id = v_user
  ) INTO v_in_general;

  IF NOT v_in_general THEN
    RAISE EXCEPTION 'AUDIT-4 verify failed: join approval did not add member to General chat';
  END IF;
END $$;

ROLLBACK;

-- 2) Executive promotion auto-provisions Executive Team chat (rolled back)
BEGIN;

DO $$
DECLARE
  v_club uuid;
  v_user uuid;
  v_exec uuid;
  v_in_exec boolean;
BEGIN
  SELECT cm.club_id, cm.user_id
  INTO v_club, v_user
  FROM public.club_members cm
  WHERE cm.status = 'active'
    AND cm.role = 'member'
    AND COALESCE(cm.access_level, 'member') = 'member'
  LIMIT 1;

  IF v_club IS NULL THEN
    RAISE EXCEPTION 'AUDIT-4 verify failed: need active general member';
  END IF;

  UPDATE public.club_members
  SET access_level = 'executive'
  WHERE club_id = v_club AND user_id = v_user;

  v_exec := public.get_club_group_conversation(v_club, 'Executive Team');

  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = v_exec AND cm.user_id = v_user
  ) INTO v_in_exec;

  IF NOT v_in_exec THEN
    RAISE EXCEPTION 'AUDIT-4 verify failed: executive promotion did not add member to Executive Team chat';
  END IF;
END $$;

ROLLBACK;

-- 3) New club creator gets president access_level via trigger (rolled back)
BEGIN;

DO $$
DECLARE
  v_user uuid;
  v_club uuid;
  v_access text;
BEGIN
  SELECT p.id INTO v_user FROM public.profiles p ORDER BY p.created_at DESC LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'AUDIT-4 verify failed: need profile for club create probe';
  END IF;

  INSERT INTO public.clubs (name, slug, created_by, is_public)
  VALUES (
    'AUDIT-4 club probe ' || substr(gen_random_uuid()::text, 1, 8),
    'audit-4-probe-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    v_user,
    false
  )
  RETURNING id INTO v_club;

  SELECT cm.access_level
  INTO v_access
  FROM public.club_members cm
  WHERE cm.club_id = v_club AND cm.user_id = v_user;

  IF v_access IS DISTINCT FROM 'president' THEN
    RAISE EXCEPTION 'AUDIT-4 verify failed: creator access_level is %, expected president', v_access;
  END IF;
END $$;

ROLLBACK;
