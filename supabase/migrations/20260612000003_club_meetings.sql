CREATE TABLE IF NOT EXISTS public.club_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_type text NOT NULL DEFAULT 'general'
    CHECK (meeting_type IN ('general', 'executive', 'committee', 'event_planning', 'hiring', 'other')),
  date timestamptz NOT NULL,
  location text,
  meeting_link text,
  agenda text,
  notes text,
  is_recurring boolean DEFAULT false,
  recurrence_pattern text CHECK (recurrence_pattern IN ('weekly', 'biweekly', 'monthly')),
  status text DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meeting_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.club_meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  assignee_id uuid REFERENCES auth.users(id),
  due_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  linked_task_id uuid REFERENCES public.tasks(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_meetings_club_id ON public.club_meetings(club_id);
CREATE INDEX IF NOT EXISTS idx_club_meetings_date ON public.club_meetings(date);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_meeting_id ON public.meeting_action_items(meeting_id);

ALTER TABLE public.club_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view meetings" ON public.club_meetings;
CREATE POLICY "Club members can view meetings"
  ON public.club_meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_meetings.club_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Privileged members can manage meetings" ON public.club_meetings;
CREATE POLICY "Privileged members can manage meetings"
  ON public.club_meetings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_meetings.club_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'executive')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = club_meetings.club_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "Club members can view action items" ON public.meeting_action_items;
CREATE POLICY "Club members can view action items"
  ON public.meeting_action_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_meetings cm
      JOIN public.club_members mem ON mem.club_id = cm.club_id
      WHERE cm.id = meeting_action_items.meeting_id AND mem.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Privileged members can manage action items" ON public.meeting_action_items;
CREATE POLICY "Privileged members can manage action items"
  ON public.meeting_action_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.club_meetings cm
      JOIN public.club_members mem ON mem.club_id = cm.club_id
      WHERE cm.id = meeting_action_items.meeting_id
        AND mem.user_id = auth.uid()
        AND mem.role IN ('owner', 'executive')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_meetings cm
      JOIN public.club_members mem ON mem.club_id = cm.club_id
      WHERE cm.id = meeting_action_items.meeting_id
        AND mem.user_id = auth.uid()
        AND mem.role IN ('owner', 'executive')
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meeting_action_items_assignee_profile_fkey'
  ) THEN
    ALTER TABLE public.meeting_action_items
      ADD CONSTRAINT meeting_action_items_assignee_profile_fkey
      FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
