ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS claim_status text NOT NULL DEFAULT 'unclaimed';

ALTER TABLE public.clubs DROP CONSTRAINT IF EXISTS clubs_claim_status_check;

ALTER TABLE public.clubs ADD CONSTRAINT clubs_claim_status_check
  CHECK (claim_status IN ('unclaimed', 'claim_pending', 'claimed', 'active'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clubs'
      AND column_name = 'is_approved'
  ) THEN
    UPDATE public.clubs
    SET claim_status = 'active'
    WHERE is_approved = true;
  END IF;
END $$;

UPDATE public.clubs AS c
SET claim_status = 'active'
WHERE c.claim_status = 'unclaimed'
  AND EXISTS (
    SELECT 1
    FROM public.club_members AS cm
    WHERE cm.club_id = c.id
      AND cm.role = 'owner'
      AND cm.status = 'active'
  );

CREATE TABLE IF NOT EXISTS public.club_claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id),
  role_in_club text NOT NULL,
  message text,
  proof_url text,
  contact_email text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'more_info')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_claim_requests_club_id
  ON public.club_claim_requests(club_id);

CREATE INDEX IF NOT EXISTS idx_club_claim_requests_status
  ON public.club_claim_requests(status);

ALTER TABLE public.club_claim_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit claim requests" ON public.club_claim_requests;
CREATE POLICY "Users can submit claim requests"
  ON public.club_claim_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users can view own claim requests" ON public.club_claim_requests;
CREATE POLICY "Users can view own claim requests"
  ON public.club_claim_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Admins can manage claim requests" ON public.club_claim_requests;
CREATE POLICY "Admins can manage claim requests"
  ON public.club_claim_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND email LIKE '%@uoguelph.ca'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND email LIKE '%@uoguelph.ca'
    )
  );

DROP POLICY IF EXISTS "Platform admins manage claim requests" ON public.club_claim_requests;
CREATE POLICY "Platform admins manage claim requests"
  ON public.club_claim_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can mark unclaimed clubs claim pending" ON public.clubs;
CREATE POLICY "Users can mark unclaimed clubs claim pending"
  ON public.clubs FOR UPDATE
  TO authenticated
  USING (claim_status = 'unclaimed')
  WITH CHECK (claim_status = 'claim_pending');

DROP POLICY IF EXISTS "Platform admins update club claim status" ON public.clubs;
CREATE POLICY "Platform admins update club claim status"
  ON public.clubs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform admins insert club members" ON public.club_members;
CREATE POLICY "Platform admins insert club members"
  ON public.club_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins
      WHERE user_id = auth.uid()
    )
  );
