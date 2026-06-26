-- AUDIT-2: Defensive deploy of 20260626000001 (club membership helpers + conversation/task/event RLS).
-- Idempotent: safe to re-run on environments where objects were cherry-picked.

CREATE OR REPLACE FUNCTION public.is_active_club_member(
  p_club_id uuid,
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
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_club_executive(
  p_club_id uuid,
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
    FROM public.club_members AS cm
    WHERE cm.club_id = p_club_id
      AND cm.user_id = p_user_id
      AND cm.status = 'active'
      AND cm.role IN ('owner', 'executive', 'admin', 'exec')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_active_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_club_executive(uuid, uuid) TO authenticated;

-- ─── conversations ───
DROP POLICY IF EXISTS "conversations_select_member" ON public.conversations;
CREATE POLICY "conversations_select_member"
  ON public.conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_members AS cm
      WHERE cm.conversation_id = conversations.id
        AND cm.user_id = auth.uid()
    )
    OR (
      conversations.created_by = auth.uid()
      AND public.is_active_club_member(conversations.club_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "conversations_insert_club_member" ON public.conversations;
CREATE POLICY "conversations_insert_club_member"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND club_id IS NOT NULL
    AND public.is_active_club_member(club_id, auth.uid())
    AND (
      type = 'direct'
      OR public.is_club_executive(club_id, auth.uid())
    )
  );

-- ─── conversation_members ───
DROP POLICY IF EXISTS "conversation_members_insert" ON public.conversation_members;
CREATE POLICY "conversation_members_insert"
  ON public.conversation_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations AS c
      WHERE c.id = conversation_members.conversation_id
        AND (
          c.created_by = auth.uid()
          OR conversation_members.user_id = auth.uid()
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.conversations AS c
      WHERE c.id = conversation_members.conversation_id
        AND public.is_active_club_member(c.club_id, conversation_members.user_id)
    )
  );

-- ─── tasks ───
DROP POLICY IF EXISTS "tasks_insert_privileged" ON public.tasks;
CREATE POLICY "tasks_insert_privileged"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_club_executive(tasks.club_id, auth.uid())
  );

DROP POLICY IF EXISTS "tasks_update_privileged" ON public.tasks;
CREATE POLICY "tasks_update_privileged"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_club_executive(tasks.club_id, auth.uid())
  );

DROP POLICY IF EXISTS "tasks_delete_privileged" ON public.tasks;
CREATE POLICY "tasks_delete_privileged"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_club_executive(tasks.club_id, auth.uid())
  );

-- ─── events ───
DROP POLICY IF EXISTS "events_insert_privileged" ON public.events;
CREATE POLICY "events_insert_privileged"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND public.is_club_executive(events.club_id, auth.uid())
  );

DROP POLICY IF EXISTS "events_update_privileged" ON public.events;
CREATE POLICY "events_update_privileged"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    public.is_club_executive(events.club_id, auth.uid())
  );

DROP POLICY IF EXISTS "events_delete_privileged" ON public.events;
CREATE POLICY "events_delete_privileged"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (
    public.is_club_executive(events.club_id, auth.uid())
  );

-- Internal executive notes (also patched in AUDIT-1; keep idempotent).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.events.notes IS
  'Internal post-event notes and recap for club executives; not shown on public event pages.';
