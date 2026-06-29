-- Add pending_review status for delegated task completion workflow.

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled', 'pending_review'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tasks_pending_review_creator
  ON public.tasks (club_id, created_by, status)
  WHERE status = 'pending_review';
