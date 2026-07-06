-- Lock down deprecated legacy hiring tables and make club-documents bucket private.

-- ─── Legacy tables: no frontend usage; platform admins only ───

-- club_positions
DROP POLICY IF EXISTS "Anyone can view open positions" ON public.club_positions;
DROP POLICY IF EXISTS "Executives can manage positions" ON public.club_positions;
DROP POLICY IF EXISTS "Executives can update positions" ON public.club_positions;
DROP POLICY IF EXISTS "Executives can delete positions" ON public.club_positions;

CREATE POLICY "legacy_club_positions_platform_admin"
  ON public.club_positions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- position_questions
DROP POLICY IF EXISTS "Anyone can view position questions" ON public.position_questions;
DROP POLICY IF EXISTS "Executives can manage questions" ON public.position_questions;
DROP POLICY IF EXISTS "Executives can update questions" ON public.position_questions;
DROP POLICY IF EXISTS "Executives can delete questions" ON public.position_questions;

CREATE POLICY "legacy_position_questions_platform_admin"
  ON public.position_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- position_applications
DROP POLICY IF EXISTS "Members can apply" ON public.position_applications;
DROP POLICY IF EXISTS "Applicants can view own applications" ON public.position_applications;
DROP POLICY IF EXISTS "Executives can view all applications" ON public.position_applications;
DROP POLICY IF EXISTS "Executives can update application status" ON public.position_applications;

CREATE POLICY "legacy_position_applications_platform_admin"
  ON public.position_applications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- job_applications
DROP POLICY IF EXISTS "Applicants can insert own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Applicants can view own applications" ON public.job_applications;
DROP POLICY IF EXISTS "Executives can update application status" ON public.job_applications;

CREATE POLICY "legacy_job_applications_platform_admin"
  ON public.job_applications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.platform_admins AS pa
      WHERE pa.user_id = auth.uid()
    )
  );

-- ─── Hiring / club document files: private bucket (signed URLs + storage RLS) ───
UPDATE storage.buckets
SET public = false
WHERE id = 'club-documents';
