-- Configurable resume / portfolio / other file slots on hiring listings.
ALTER TABLE public.hiring_listings
  ADD COLUMN IF NOT EXISTS upload_fields jsonb NOT NULL DEFAULT '{
    "resume": "not_included",
    "portfolio": "not_included",
    "other": "not_included"
  }'::jsonb;

COMMENT ON COLUMN public.hiring_listings.upload_fields IS
  'Per-slot upload settings: required | optional | not_included for resume, portfolio, other';

-- Allow authenticated applicants to upload hiring application files under their own folder.
DROP POLICY IF EXISTS "club_documents_hiring_applicant_upload" ON storage.objects;
CREATE POLICY "club_documents_hiring_applicant_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-documents'
    AND (storage.foldername(name))[2] = 'hiring-applications'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );
