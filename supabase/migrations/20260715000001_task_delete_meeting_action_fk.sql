-- meeting_action_items.linked_task_id blocked task deletes (no ON DELETE rule).
-- Null out links automatically when a task row is removed.

DO $$
DECLARE
  v_constraint name;
BEGIN
  SELECT c.conname
  INTO v_constraint
  FROM pg_constraint AS c
  JOIN pg_class AS t ON t.oid = c.conrelid
  JOIN pg_attribute AS a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
  WHERE t.relname = 'meeting_action_items'
    AND a.attname = 'linked_task_id'
    AND c.contype = 'f'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.meeting_action_items DROP CONSTRAINT %I',
      v_constraint
    );
  END IF;
END $$;

ALTER TABLE public.meeting_action_items
  DROP CONSTRAINT IF EXISTS meeting_action_items_linked_task_id_fkey;

ALTER TABLE public.meeting_action_items
  ADD CONSTRAINT meeting_action_items_linked_task_id_fkey
  FOREIGN KEY (linked_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;
