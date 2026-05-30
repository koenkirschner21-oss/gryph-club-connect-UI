-- =============================================================================
-- Club email invites (magic link)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.club_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id),
  token text DEFAULT gen_random_uuid()::text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_club_invites_token ON public.club_invites(token);
CREATE INDEX IF NOT EXISTS idx_club_invites_club_id ON public.club_invites(club_id);

ALTER TABLE public.club_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Presidents can create invites" ON public.club_invites;
CREATE POLICY "Presidents can create invites"
  ON public.club_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = invited_by);

DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.club_invites;
CREATE POLICY "Anyone can view invite by token"
  ON public.club_invites
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can accept pending invites" ON public.club_invites;
CREATE POLICY "Authenticated can accept pending invites"
  ON public.club_invites
  FOR UPDATE
  TO authenticated
  USING (status = 'pending')
  WITH CHECK (status IN ('accepted', 'expired'));
