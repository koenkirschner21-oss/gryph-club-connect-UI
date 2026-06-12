CREATE TABLE IF NOT EXISTS public.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES auth.users(id),
  to_user_id uuid REFERENCES auth.users(id),
  new_role text NOT NULL CHECK (new_role IN ('owner', 'co_president')),
  optional_message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'canceled', 'expired')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days',
  responded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_club_status
  ON public.ownership_transfers(club_id, status);

CREATE INDEX IF NOT EXISTS idx_ownership_transfers_to_user_pending
  ON public.ownership_transfers(to_user_id, status)
  WHERE status = 'pending';

ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club owners can manage transfers" ON public.ownership_transfers;
CREATE POLICY "Club owners can manage transfers"
  ON public.ownership_transfers
  FOR ALL
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);
