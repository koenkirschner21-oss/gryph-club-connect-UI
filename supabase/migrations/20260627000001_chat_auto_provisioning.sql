-- Auto-provision General / Executive Team group chats, sync membership on join/promotion,
-- and post join system messages at the moment of approval (not at request time).

CREATE OR REPLACE FUNCTION public.club_chat_provisioning_actor(p_club_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT cm.user_id
      FROM public.club_members AS cm
      WHERE cm.club_id = p_club_id
        AND cm.status = 'active'
        AND cm.role = 'owner'
      ORDER BY cm.created_at ASC
      LIMIT 1
    ),
    (SELECT c.created_by FROM public.clubs AS c WHERE c.id = p_club_id),
    (
      SELECT cm.user_id
      FROM public.club_members AS cm
      WHERE cm.club_id = p_club_id
        AND cm.status = 'active'
      ORDER BY cm.created_at ASC
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_chat_executive(
  p_club_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
      AND cm.role IN ('owner', 'executive', 'admin', 'exec')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_club_group_conversation(
  p_club_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid;
  v_trimmed text := trim(p_name);
BEGIN
  SELECT c.id
  INTO v_id
  FROM public.conversations AS c
  WHERE c.club_id = p_club_id
    AND c.type = 'group'
    AND lower(trim(c.name)) = lower(v_trimmed)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_actor := public.club_chat_provisioning_actor(p_club_id);

  INSERT INTO public.conversations (club_id, type, name, created_by)
  VALUES (p_club_id, 'group', v_trimmed, v_actor)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_club_default_conversations(p_club_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.get_club_group_conversation(p_club_id, 'General');
  PERFORM public.get_club_group_conversation(p_club_id, 'Executive Team');
END;
$$;

CREATE OR REPLACE FUNCTION public.add_conversation_member_if_missing(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (p_conversation_id, p_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_conversation_system_message(
  p_conversation_id uuid,
  p_body text,
  p_created_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz := COALESCE(p_created_at, now());
BEGIN
  INSERT INTO public.direct_messages (conversation_id, sender_id, content, created_at)
  VALUES (
    p_conversation_id,
    NULL,
    '[gryph-system:member_joined] ' || btrim(p_body),
    v_at
  );

  UPDATE public.conversations
  SET updated_at = v_at
  WHERE id = p_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_club_member_chats(
  p_club_id uuid,
  p_user_id uuid,
  p_post_join_message boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_general_id uuid;
  v_exec_id uuid;
  v_name text;
BEGIN
  PERFORM public.ensure_club_default_conversations(p_club_id);

  v_general_id := public.get_club_group_conversation(p_club_id, 'General');
  PERFORM public.add_conversation_member_if_missing(v_general_id, p_user_id);

  IF public.is_club_chat_executive(p_club_id, p_user_id) THEN
    v_exec_id := public.get_club_group_conversation(p_club_id, 'Executive Team');
    PERFORM public.add_conversation_member_if_missing(v_exec_id, p_user_id);
  END IF;

  IF p_post_join_message THEN
    SELECT COALESCE(NULLIF(btrim(full_name), ''), 'A member')
    INTO v_name
    FROM public.profiles
    WHERE id = p_user_id;

    PERFORM public.post_conversation_system_message(
      v_general_id,
      v_name || ' just joined the club!',
      now()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_provision_club_default_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_club_default_conversations(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_club_member_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.provision_club_member_chats(
      NEW.club_id,
      NEW.user_id,
      NEW.role <> 'owner'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active' THEN
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        NEW.role <> 'owner'
      );
    ELSIF NEW.status = 'active'
      AND (
        OLD.role IS DISTINCT FROM NEW.role
        OR OLD.access_level IS DISTINCT FROM NEW.access_level
      ) THEN
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        false
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_created_provision_chats ON public.clubs;
CREATE TRIGGER on_club_created_provision_chats
  AFTER INSERT ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_provision_club_default_chats();

DROP TRIGGER IF EXISTS on_club_member_sync_chats ON public.club_members;
CREATE TRIGGER on_club_member_sync_chats
  AFTER INSERT OR UPDATE OF status, role, access_level ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_club_member_chats();

-- Backfill default conversations and memberships for existing clubs (no historical join messages).
DO $$
DECLARE
  club_row record;
  member_row record;
BEGIN
  FOR club_row IN SELECT id FROM public.clubs LOOP
    PERFORM public.ensure_club_default_conversations(club_row.id);

    FOR member_row IN
      SELECT user_id
      FROM public.club_members
      WHERE club_id = club_row.id
        AND status = 'active'
    LOOP
      PERFORM public.provision_club_member_chats(
        club_row.id,
        member_row.user_id,
        false
      );
    END LOOP;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_club_default_conversations(uuid) TO authenticated;
