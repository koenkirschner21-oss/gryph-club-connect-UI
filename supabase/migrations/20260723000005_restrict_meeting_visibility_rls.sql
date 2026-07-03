-- Restrict meeting visibility to invited users unless the viewer has meeting
-- management access or president/managerial-executive access.

CREATE OR REPLACE FUNCTION public.can_view_club_meeting(
  p_meeting_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_notes text;
  v_group text := 'all_members';
  v_meta jsonb := '{}'::jsonb;
  v_meta_start constant text := '<!--gryph-meeting-meta' || chr(10);
  v_meta_end constant text := chr(10) || '-->';
  v_end_pos integer;
  v_json text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT cm.club_id, cm.notes
  INTO v_club_id, v_notes
  FROM public.club_meetings AS cm
  WHERE cm.id = p_meeting_id;

  IF v_club_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.club_has_permission(v_club_id, 'manage_meetings', p_user_id)
     OR public.club_member_permission_role(v_club_id, p_user_id) IN ('president', 'managerial_executive') THEN
    RETURN true;
  END IF;

  IF NOT public.is_active_club_member(v_club_id, p_user_id) THEN
    RETURN false;
  END IF;

  IF v_notes IS NOT NULL AND left(v_notes, length(v_meta_start)) = v_meta_start THEN
    v_end_pos := strpos(v_notes, v_meta_end);
    IF v_end_pos > length(v_meta_start) THEN
      v_json := substr(
        v_notes,
        length(v_meta_start) + 1,
        v_end_pos - length(v_meta_start) - 1
      );
      BEGIN
        v_meta := v_json::jsonb;
        v_group := COALESCE(NULLIF(v_meta ->> 'inviteeGroup', ''), 'all_members');
      EXCEPTION WHEN others THEN
        v_meta := '{}'::jsonb;
        v_group := 'all_members';
      END;
    END IF;
  END IF;

  CASE v_group
    WHEN 'all_members' THEN
      RETURN true;
    WHEN 'all_executives' THEN
      RETURN public.club_member_is_executive_or_above(v_club_id, p_user_id);
    WHEN 'president_team' THEN
      RETURN public.club_member_permission_role(v_club_id, p_user_id) = 'president';
    WHEN 'custom' THEN
      RETURN EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(v_meta -> 'customInviteeIds', '[]'::jsonb)) AS invitee(user_id)
        WHERE invitee.user_id = p_user_id::text
      );
    ELSE
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_club_meeting(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Club members can view meetings" ON public.club_meetings;
DROP POLICY IF EXISTS "club_meetings_select_invited" ON public.club_meetings;
DROP POLICY IF EXISTS "Privileged members can manage meetings" ON public.club_meetings;
DROP POLICY IF EXISTS "club_meetings_manage_permission" ON public.club_meetings;

CREATE POLICY "club_meetings_select_invited"
  ON public.club_meetings
  FOR SELECT
  TO authenticated
  USING (public.can_view_club_meeting(id, auth.uid()));

CREATE POLICY "club_meetings_insert_manage_permission"
  ON public.club_meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.club_has_permission(club_id, 'manage_meetings', auth.uid()));

CREATE POLICY "club_meetings_update_manage_permission"
  ON public.club_meetings
  FOR UPDATE
  TO authenticated
  USING (public.club_has_permission(club_id, 'manage_meetings', auth.uid()))
  WITH CHECK (public.club_has_permission(club_id, 'manage_meetings', auth.uid()));

CREATE POLICY "club_meetings_delete_manage_permission"
  ON public.club_meetings
  FOR DELETE
  TO authenticated
  USING (public.club_has_permission(club_id, 'manage_meetings', auth.uid()));

DROP POLICY IF EXISTS "Club members can view action items" ON public.meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_select_visible_meetings" ON public.meeting_action_items;
DROP POLICY IF EXISTS "Privileged members can manage action items" ON public.meeting_action_items;
DROP POLICY IF EXISTS "meeting_action_items_manage_permission" ON public.meeting_action_items;

CREATE POLICY "meeting_action_items_select_visible_meetings"
  ON public.meeting_action_items
  FOR SELECT
  TO authenticated
  USING (public.can_view_club_meeting(meeting_id, auth.uid()));

CREATE POLICY "meeting_action_items_insert_manage_permission"
  ON public.meeting_action_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.club_meetings AS cm
      WHERE cm.id = meeting_action_items.meeting_id
        AND public.club_has_permission(cm.club_id, 'manage_meetings', auth.uid())
    )
  );

CREATE POLICY "meeting_action_items_update_manage_permission"
  ON public.meeting_action_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_meetings AS cm
      WHERE cm.id = meeting_action_items.meeting_id
        AND public.club_has_permission(cm.club_id, 'manage_meetings', auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.club_meetings AS cm
      WHERE cm.id = meeting_action_items.meeting_id
        AND public.club_has_permission(cm.club_id, 'manage_meetings', auth.uid())
    )
  );

CREATE POLICY "meeting_action_items_delete_manage_permission"
  ON public.meeting_action_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_meetings AS cm
      WHERE cm.id = meeting_action_items.meeting_id
        AND public.club_has_permission(cm.club_id, 'manage_meetings', auth.uid())
    )
  );
