-- Task policies still referenced legacy admin/exec roles after executive migration.

DROP POLICY IF EXISTS "tasks_insert_privileged" ON public.tasks;
CREATE POLICY "tasks_insert_privileged"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = tasks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "tasks_update_privileged" ON public.tasks;
CREATE POLICY "tasks_update_privileged"
  ON public.tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = tasks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "tasks_delete_privileged" ON public.tasks;
CREATE POLICY "tasks_delete_privileged"
  ON public.tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = tasks.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  );
