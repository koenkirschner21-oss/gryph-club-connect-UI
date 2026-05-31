ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS join_type text DEFAULT 'open'
  CHECK (join_type IN ('open', 'application', 'vote'));

ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS join_questions jsonb DEFAULT '[]';

CREATE TABLE IF NOT EXISTS public.club_join_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES auth.users(id),
  answers jsonb DEFAULT '[]',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.club_join_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES auth.users(id),
  voter_id uuid REFERENCES auth.users(id),
  vote text CHECK (vote IN ('yes', 'no')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, applicant_id, voter_id)
);

ALTER TABLE public.club_join_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_join_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can apply to join" ON public.club_join_applications;
CREATE POLICY "Anyone can apply to join"
ON public.club_join_applications FOR INSERT
WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Applicants can view own applications" ON public.club_join_applications;
CREATE POLICY "Applicants can view own applications"
ON public.club_join_applications FOR SELECT
USING (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Presidents and execs can view applications for their club" ON public.club_join_applications;
CREATE POLICY "Presidents and execs can view applications for their club"
ON public.club_join_applications FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_join_applications.club_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'executive')
  )
);

DROP POLICY IF EXISTS "Presidents can update application status" ON public.club_join_applications;
CREATE POLICY "Presidents can update application status"
ON public.club_join_applications FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_join_applications.club_id
    AND cm.user_id = auth.uid()
    AND cm.role = 'owner'
  )
);

DROP POLICY IF EXISTS "Executives can vote" ON public.club_join_votes;
CREATE POLICY "Executives can vote"
ON public.club_join_votes FOR INSERT
WITH CHECK (
  auth.uid() = voter_id AND
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_join_votes.club_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'executive')
  )
);

DROP POLICY IF EXISTS "Executives can view votes for their club" ON public.club_join_votes;
CREATE POLICY "Executives can view votes for their club"
ON public.club_join_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = club_join_votes.club_id
    AND cm.user_id = auth.uid()
    AND cm.role IN ('owner', 'executive')
  )
);
