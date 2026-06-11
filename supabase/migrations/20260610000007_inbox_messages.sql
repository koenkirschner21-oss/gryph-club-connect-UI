CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN (
    'interview_invite', 'interview_confirmed', 'role_offer',
    'club_invite', 'executive_invite', 'ownership_transfer',
    'join_approved', 'join_rejected', 'application_update',
    'offer_accepted', 'offer_declined', 'admin_message',
    'candidate_selected_time', 'invite_accepted', 'invite_declined',
    'role_updated', 'system_message'
  )),
  title text NOT NULL,
  message text NOT NULL,
  action_required boolean DEFAULT false,
  action_completed boolean DEFAULT false,
  action_type text,
  action_data jsonb DEFAULT '{}'::jsonb,
  club_id uuid REFERENCES public.clubs(id),
  reference_id uuid,
  reference_type text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_recipient_created
  ON public.inbox_messages(recipient_id, created_at DESC);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own inbox" ON public.inbox_messages;
CREATE POLICY "Users can view own inbox"
  ON public.inbox_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can update own inbox" ON public.inbox_messages;
CREATE POLICY "Users can update own inbox"
  ON public.inbox_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "System can insert inbox messages" ON public.inbox_messages;
CREATE POLICY "System can insert inbox messages"
  ON public.inbox_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);
