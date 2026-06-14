ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'general'
    CHECK (task_type IN ('general', 'event', 'hiring', 'setup', 'meeting'));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_meeting_id uuid REFERENCES public.club_meetings(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_hiring_listing_id uuid REFERENCES public.hiring_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_linked_event_id ON public.tasks(linked_event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_linked_meeting_id ON public.tasks(linked_meeting_id);
