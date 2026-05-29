-- Club creation requests (admin approval flow)
CREATE TABLE IF NOT EXISTS public.club_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by uuid REFERENCES auth.users(id),
  name text NOT NULL,
  short_description text,
  long_description text,
  category text,
  requested_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  review_note text,
  reviewed_at timestamptz
);

ALTER TABLE public.club_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit club requests" ON public.club_requests;
CREATE POLICY "Users can submit club requests"
  ON public.club_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users can view own requests" ON public.club_requests;
CREATE POLICY "Users can view own requests"
  ON public.club_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = submitted_by);
