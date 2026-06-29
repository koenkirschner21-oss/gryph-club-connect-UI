-- Personal, private meeting prep checklist items (per user, not club tasks).

CREATE TABLE IF NOT EXISTS public.meeting_prep_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_key text NOT NULL,
  item_key text NOT NULL,
  label text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  converted_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id, meeting_key, item_key)
);

CREATE INDEX IF NOT EXISTS idx_meeting_prep_items_lookup
  ON public.meeting_prep_items (club_id, user_id, meeting_key);

ALTER TABLE public.meeting_prep_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meeting_prep_items_select_own" ON public.meeting_prep_items;
CREATE POLICY "meeting_prep_items_select_own"
  ON public.meeting_prep_items FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "meeting_prep_items_insert_own" ON public.meeting_prep_items;
CREATE POLICY "meeting_prep_items_insert_own"
  ON public.meeting_prep_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "meeting_prep_items_update_own" ON public.meeting_prep_items;
CREATE POLICY "meeting_prep_items_update_own"
  ON public.meeting_prep_items FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "meeting_prep_items_delete_own" ON public.meeting_prep_items;
CREATE POLICY "meeting_prep_items_delete_own"
  ON public.meeting_prep_items FOR DELETE
  USING (user_id = auth.uid());
