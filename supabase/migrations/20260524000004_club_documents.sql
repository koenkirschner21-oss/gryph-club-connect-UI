CREATE TABLE IF NOT EXISTS club_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE club_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members can view documents" ON club_documents;
CREATE POLICY "Club members can view documents"
ON club_documents FOR SELECT
USING (
  club_id IN (
    SELECT club_id FROM club_members
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Executives and presidents can upload documents" ON club_documents;
CREATE POLICY "Executives and presidents can upload documents"
ON club_documents FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM club_members
    WHERE club_id = club_documents.club_id
    AND role IN ('owner', 'executive')
  )
);

DROP POLICY IF EXISTS "Executives and presidents can delete documents" ON club_documents;
CREATE POLICY "Executives and presidents can delete documents"
ON club_documents FOR DELETE
USING (
  auth.uid() IN (
    SELECT user_id FROM club_members
    WHERE club_id = club_documents.club_id
    AND role IN ('owner', 'executive')
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('club-documents', 'club-documents', true, 52428800)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "club_documents_storage_select" ON storage.objects;
CREATE POLICY "club_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'club-documents');

DROP POLICY IF EXISTS "club_documents_storage_insert" ON storage.objects;
CREATE POLICY "club_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'club-documents'
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
        AND (storage.foldername(name))[1] = cm.club_id::text
    )
  );

DROP POLICY IF EXISTS "club_documents_storage_delete" ON storage.objects;
CREATE POLICY "club_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'club-documents'
    AND EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
        AND (storage.foldername(name))[1] = cm.club_id::text
    )
  );
