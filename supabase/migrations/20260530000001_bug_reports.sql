CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by uuid REFERENCES auth.users(id),
  page text,
  description text NOT NULL,
  severity text DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'critical')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can submit bug reports" ON public.bug_reports;
CREATE POLICY "Users can submit bug reports"
ON public.bug_reports FOR INSERT
WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Admins can view bug reports" ON public.bug_reports;
CREATE POLICY "Admins can view bug reports"
ON public.bug_reports FOR SELECT
USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update bug reports" ON public.bug_reports;
CREATE POLICY "Admins can update bug reports"
ON public.bug_reports FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));
