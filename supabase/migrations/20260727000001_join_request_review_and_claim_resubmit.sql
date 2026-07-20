-- Join-request approve/reject RPCs, pending-applicant same-club DMs, claim resubmit.

-- ─── Optional decline note on join rows (notification still carries reason) ───
ALTER TABLE public.club_members
  ADD COLUMN IF NOT EXISTS rejection_note text;

-- ─── Approve pending join request (idempotent) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_club_join_request(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.club_members%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'member_id_required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.club_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'join_request_not_found';
  END IF;

  IF NOT public.club_has_permission(v_row.club_id, 'approve_members', v_user) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Already active: treat as successful resolution (idempotent).
  IF COALESCE(v_row.status, 'active') = 'active' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_active',
      'member_id', v_row.id,
      'club_id', v_row.club_id,
      'user_id', v_row.user_id,
      'status', 'active',
      'role', v_row.role
    );
  END IF;

  IF v_row.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'join_request_not_pending';
  END IF;

  UPDATE public.club_members
  SET
    status = 'active',
    role = COALESCE(NULLIF(btrim(v_row.role), ''), 'member'),
    rejection_note = NULL
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'outcome', 'approved',
    'member_id', v_row.id,
    'club_id', v_row.club_id,
    'user_id', v_row.user_id,
    'status', v_row.status,
    'role', v_row.role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_club_join_request(uuid) TO authenticated;

-- ─── Reject / decline pending join request ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_club_join_request(
  p_member_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.club_members%ROWTYPE;
  v_user_id uuid;
  v_club_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_member_id IS NULL THEN
    RAISE EXCEPTION 'member_id_required';
  END IF;

  SELECT *
  INTO v_row
  FROM public.club_members
  WHERE id = p_member_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Idempotent: already removed
    RETURN jsonb_build_object(
      'outcome', 'already_removed',
      'member_id', p_member_id
    );
  END IF;

  IF NOT public.club_has_permission(v_row.club_id, 'approve_members', v_user) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF COALESCE(v_row.status, 'active') = 'active' THEN
    RAISE EXCEPTION 'join_request_already_active';
  END IF;

  IF v_row.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'join_request_not_pending';
  END IF;

  v_user_id := v_row.user_id;
  v_club_id := v_row.club_id;

  -- Persist note briefly is unnecessary once deleted; delete the pending row.
  DELETE FROM public.club_members WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'outcome', 'rejected',
    'member_id', p_member_id,
    'club_id', v_club_id,
    'user_id', v_user_id,
    'reason', NULLIF(btrim(COALESCE(p_reason, '')), '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_club_join_request(uuid, text) TO authenticated;

-- ─── Preserve reviewer↔applicant DMs when membership is pending ─────────────
CREATE OR REPLACE FUNCTION public.deprovision_club_member_group_chats(
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
    AND c.type IS DISTINCT FROM 'direct';
END;
$$;

GRANT EXECUTE ON FUNCTION public.deprovision_club_member_group_chats(uuid, uuid) TO authenticated;

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
    ELSIF NEW.status = 'pending' THEN
      -- Pending applicants must not join group chats, but may keep reviewer DMs.
      PERFORM public.deprovision_club_member_group_chats(NEW.club_id, NEW.user_id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'active' THEN
    IF OLD.status IS DISTINCT FROM 'active' THEN
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        NEW.role <> 'owner'
      );
    ELSIF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.access_level IS DISTINCT FROM NEW.access_level THEN
      PERFORM public.provision_club_member_chats(
        NEW.club_id,
        NEW.user_id,
        false
      );
      IF NOT public.is_club_chat_executive(NEW.club_id, NEW.user_id) THEN
        PERFORM public.deprovision_club_member_exec_chats(
          NEW.club_id,
          NEW.user_id
        );
      END IF;
    END IF;
  ELSIF NEW.status = 'pending' THEN
    PERFORM public.deprovision_club_member_group_chats(NEW.club_id, NEW.user_id);
  ELSE
    PERFORM public.deprovision_club_member_chats(NEW.club_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Legacy revoke-all-on-pending trigger: align with group-only strip.
CREATE OR REPLACE FUNCTION public.trg_revoke_pending_member_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM public.deprovision_club_member_group_chats(NEW.club_id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Pending applicants may access same-club direct conversations only.
CREATE OR REPLACE FUNCTION public.is_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members AS cm
    INNER JOIN public.conversations AS c
      ON c.id = cm.conversation_id
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = p_user_id
      AND (
        c.club_id IS NULL
        OR public.is_active_club_member(c.club_id, p_user_id)
        OR (
          c.type = 'direct'
          AND EXISTS (
            SELECT 1
            FROM public.club_members AS m
            WHERE m.club_id = c.club_id
              AND m.user_id = p_user_id
              AND m.status = 'pending'
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;

-- Reviewers with approve_members may open a same-club DM with a pending applicant.
CREATE OR REPLACE FUNCTION public.find_or_create_direct_conversation(
  p_other_user_id uuid,
  p_club_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_lock_key bigint;
  v_low uuid;
  v_high uuid;
  v_other_active boolean;
  v_other_pending boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = v_user THEN
    RAISE EXCEPTION 'invalid_other_user';
  END IF;

  IF p_club_id IS NULL THEN
    RAISE EXCEPTION 'club_id_required';
  END IF;

  IF NOT public.is_active_club_member(p_club_id, v_user) THEN
    RAISE EXCEPTION 'not_active_club_member';
  END IF;

  v_other_active := public.is_active_club_member(p_club_id, p_other_user_id);
  v_other_pending := EXISTS (
    SELECT 1
    FROM public.club_members AS m
    WHERE m.club_id = p_club_id
      AND m.user_id = p_other_user_id
      AND m.status = 'pending'
  );

  IF NOT v_other_active AND NOT v_other_pending THEN
    RAISE EXCEPTION 'other_not_club_member';
  END IF;

  IF v_other_pending AND NOT v_other_active THEN
    IF NOT public.club_has_permission(p_club_id, 'approve_members', v_user) THEN
      RAISE EXCEPTION 'not_authorized_to_message_applicant';
    END IF;
  END IF;

  IF v_user < p_other_user_id THEN
    v_low := v_user;
    v_high := p_other_user_id;
  ELSE
    v_low := p_other_user_id;
    v_high := v_user;
  END IF;

  v_lock_key := hashtextextended(
    p_club_id::text || ':' || v_low::text || ':' || v_high::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT c.id
  INTO v_id
  FROM public.conversations AS c
  WHERE c.club_id = p_club_id
    AND c.type = 'direct'
    AND EXISTS (
      SELECT 1 FROM public.conversation_members AS m
      WHERE m.conversation_id = c.id AND m.user_id = v_user
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_members AS m
      WHERE m.conversation_id = c.id AND m.user_id = p_other_user_id
    )
    AND (
      SELECT count(*) FROM public.conversation_members AS m
      WHERE m.conversation_id = c.id
    ) = 2
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.conversations (club_id, type, created_by)
  VALUES (p_club_id, 'direct', v_user)
  RETURNING id INTO v_id;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES
    (v_id, v_user),
    (v_id, p_other_user_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_direct_conversation(uuid, uuid) TO authenticated;

-- Claimant may update + resubmit their own more_info request.
CREATE OR REPLACE FUNCTION public.resubmit_club_claim_request(
  p_request_id uuid,
  p_role_in_club text,
  p_message text DEFAULT NULL,
  p_proof_url text DEFAULT NULL,
  p_contact_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request public.club_claim_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request_id_required';
  END IF;

  IF NULLIF(btrim(COALESCE(p_role_in_club, '')), '') IS NULL THEN
    RAISE EXCEPTION 'role_required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.club_claim_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_request_not_found';
  END IF;

  IF v_request.submitted_by IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'claim_request_not_owned';
  END IF;

  IF v_request.status IS DISTINCT FROM 'more_info' THEN
    RAISE EXCEPTION 'claim_request_not_editable';
  END IF;

  UPDATE public.club_claim_requests
  SET
    role_in_club = btrim(p_role_in_club),
    message = NULLIF(btrim(COALESCE(p_message, '')), ''),
    proof_url = NULLIF(btrim(COALESCE(p_proof_url, '')), ''),
    contact_email = NULLIF(btrim(COALESCE(p_contact_email, '')), ''),
    status = 'pending',
    review_note = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL
  WHERE id = v_request.id
  RETURNING * INTO v_request;

  UPDATE public.clubs
  SET claim_status = 'claim_pending'
  WHERE id = v_request.club_id
    AND claim_status = 'unclaimed';

  RETURN jsonb_build_object(
    'outcome', 'resubmitted',
    'claim_request_id', v_request.id,
    'club_id', v_request.club_id,
    'request_status', v_request.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resubmit_club_claim_request(uuid, text, text, text, text) TO authenticated;

-- Claimants may cancel from more_info as well via the existing cancel RPC (already allowed).
-- Expand direct UPDATE policy so clients that still use table updates stay consistent.
DROP POLICY IF EXISTS "Users can cancel own pending claim requests" ON public.club_claim_requests;
CREATE POLICY "Users can cancel own pending claim requests"
  ON public.club_claim_requests FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = submitted_by
    AND status IN ('pending', 'more_info')
  )
  WITH CHECK (
    auth.uid() = submitted_by
    AND status IN ('canceled', 'pending', 'more_info')
  );

NOTIFY pgrst, 'reload schema';
