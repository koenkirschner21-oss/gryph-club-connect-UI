ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.hiring_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  role_type text DEFAULT 'general' CHECK (role_type IN ('executive', 'volunteer', 'general')),
  deadline date,
  is_open boolean DEFAULT true,
  questions jsonb DEFAULT '[]',
  requirements text,
  commitment_level text DEFAULT 'flexible' CHECK (commitment_level IN ('flexible', 'part_time', 'weekly_hours')),
  weekly_hours integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hiring_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.hiring_listings(id) ON DELETE CASCADE,
  applicant_id uuid REFERENCES auth.users(id),
  answers jsonb DEFAULT '[]',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.hiring_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hiring_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view open listings" ON public.hiring_listings;
CREATE POLICY "Anyone can view open listings"
ON public.hiring_listings FOR SELECT USING (is_open = true);

DROP POLICY IF EXISTS "Execs can create listings" ON public.hiring_listings;
CREATE POLICY "Execs can create listings"
ON public.hiring_listings FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Logged in users can apply" ON public.hiring_applications;
CREATE POLICY "Logged in users can apply"
ON public.hiring_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);

DROP POLICY IF EXISTS "Applicants can view own applications" ON public.hiring_applications;
CREATE POLICY "Applicants can view own applications"
ON public.hiring_applications FOR SELECT USING (auth.uid() = applicant_id);
