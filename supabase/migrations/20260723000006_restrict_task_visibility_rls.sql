-- Restrict task visibility to assigned users unless the viewer can manage tasks.
-- Task comments follow task visibility so hidden tasks do not leak through comments.

DROP POLICY IF EXISTS "Club members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_tenant" ON public.tasks;

CREATE POLICY "tasks_select_tenant"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_club_member(club_id, auth.uid())
    AND (
      assigned_to = auth.uid()
      OR public.club_member_permission_role(club_id, auth.uid()) IN ('president', 'managerial_executive')
      OR public.club_has_permission(club_id, 'manage_tasks', auth.uid())
      OR public.club_has_permission(club_id, 'assign_tasks', auth.uid())
    )
  );

DROP POLICY IF EXISTS "Club members can view task comments" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_select_visible_tasks" ON public.task_comments;

CREATE POLICY "task_comments_select_visible_tasks"
  ON public.task_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tasks AS t
      WHERE t.id = task_comments.task_id
    )
  );
