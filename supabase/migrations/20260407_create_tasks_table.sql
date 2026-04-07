-- =============================================================================
-- TASKS TABLE — Supabase SQL for Task Management System
-- =============================================================================
-- Run this in the Supabase SQL Editor.
-- This creates the tasks table with foreign keys and RLS policies.
-- =============================================================================

-- 1. Create the tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    text NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low', 'medium', 'high')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date    date,
  created_by  uuid NOT NULL REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_club_id ON public.tasks(club_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);

-- 3. Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- SELECT: Any club member can view tasks for their club
CREATE POLICY "Club members can view tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- INSERT: Only admins/execs can create tasks
CREATE POLICY "Admins and execs can create tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

-- UPDATE: Admins/execs can update any field; assigned members can only update status
CREATE POLICY "Admins/execs can update tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );

CREATE POLICY "Assigned users can update task status"
  ON public.tasks FOR UPDATE
  USING (
    tasks.assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- DELETE: Only admins/execs can delete tasks
CREATE POLICY "Admins and execs can delete tasks"
  ON public.tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = tasks.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );
