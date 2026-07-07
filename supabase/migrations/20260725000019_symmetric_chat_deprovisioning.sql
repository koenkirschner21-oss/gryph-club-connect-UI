-- Symmetric chat de-provisioning. Provisioning was add-only (join/promote add
-- conversation_members rows); nothing removed them on leave/removal/demotion/
-- inactive. This adds the removal side, mirroring the existing add path.
--
-- Covered transitions:
--   * club_members DELETE (self-leave via leaveClub, removal via removeMember,
--     and ownership-transfer former-owner 'leave' choice which DELETEs the row):
--     remove ALL of the user's conversation_members rows for that club.
--   * club_members status moving away from 'active' (pending or any inactive
--     state): remove ALL club conversation access.
--   * role/access_level demotion out of the executive tier while still an active
--     member: remove the Executive Team (default-executive) row only, preserving
--     General chat membership.
--
-- De-provisioning ONLY deletes conversation_members rows; it never touches
-- conversations rows, so it cannot create duplicate General/Executive Team chats.
-- All operations are idempotent (plain DELETEs / ON CONFLICT DO NOTHING adds).

-- ─── Helpers ───

-- Remove every conversation_members row for a user across all of a club's
-- conversations (group + direct). Idempotent.
CREATE OR REPLACE FUNCTION public.deprovision_club_member_chats(
  p_club_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversation_members AS cm
  USING public.conversations AS c
  WHERE c.id = cm.conversation_id
    AND c.club_id = p_club_id
    AND cm.user_id = p_user_id;
END;
$$;

-- Remove only the default executive (Executive Team) conversation membership for
-- a user, preserving General and any other conversations. Idempotent.
CREATE OR REPLACE FUNCTION public.deprovision_club_member_exec_chats(
  p_club_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversation_members AS cm
  USING public.conversations AS c
  WHERE c.id = cm.conversation_id
    AND c.club_id = p_club_id
    AND cm.user_id = p_user_id
    AND c.type = 'group'
    AND lower(trim(c.name)) = 'executive team';
END;
$$;

GRANT EXECUTE ON FUNCTION public.deprovision_club_member_chats(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deprovision_club_member_exec_chats(uuid, uuid) TO authenticated;

-- ─── Sync trigger: add on join/activate/promote, remove on demote/inactive ───
CREATE OR REPLACE FUNCTION public.trg_sync_club_member_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        NEW.role <> 'owner'
      );
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status = 'active' THEN
    IF OLD.status IS DISTINCT FROM 'active' THEN
      -- (re)activation: provision General + Executive Team (if exec)
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        NEW.role <> 'owner'
      );
    ELSIF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.access_level IS DISTINCT FROM NEW.access_level THEN
      -- role/access change while active: ensure correct chats are present...
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        false
      );
      -- ...then strip Executive Team if no longer an executive (keep General)
      IF NOT public.is_club_chat_executive(NEW.club_id, NEW.user_id) THEN
        PERFORM public.deprovision_club_member_exec_chats(
          NEW.club_id,
          NEW.user_id
        );
      END IF;
    END IF;
  ELSE
    -- status moved away from active (pending / any inactive state):
    -- remove all club conversation access.
    PERFORM public.deprovision_club_member_chats(NEW.club_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_club_member_sync_chats ON public.club_members;
CREATE TRIGGER on_club_member_sync_chats
  AFTER INSERT OR UPDATE OF status, role, access_level ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_club_member_chats();

-- ─── Delete trigger: leave / removal / ownership-transfer 'leave' ───
-- apply_former_owner_role_choice('leave') DELETEs the club_members row, so this
-- trigger cleans up the former owner's chat memberships automatically, same as
-- leaveClub and removeMember.
CREATE OR REPLACE FUNCTION public.trg_deprovision_club_member_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.deprovision_club_member_chats(OLD.club_id, OLD.user_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_club_member_delete_deprovision_chats ON public.club_members;
CREATE TRIGGER on_club_member_delete_deprovision_chats
  AFTER DELETE ON public.club_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_deprovision_club_member_chats();

NOTIFY pgrst, 'reload schema';
