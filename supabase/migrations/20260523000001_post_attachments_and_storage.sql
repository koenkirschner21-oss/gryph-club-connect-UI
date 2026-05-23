-- Post attachment columns, update policy, executive role fix, and storage bucket.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS attachment_type text;

DROP POLICY IF EXISTS "posts_insert_privileged" ON public.posts;
CREATE POLICY "posts_insert_privileged"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = posts.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "posts_delete_privileged" ON public.posts;
CREATE POLICY "posts_delete_privileged"
  ON public.posts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = posts.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  );

DROP POLICY IF EXISTS "posts_update_privileged" ON public.posts;
CREATE POLICY "posts_update_privileged"
  ON public.posts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = posts.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.club_id = posts.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('announcement-attachments', 'announcement-attachments', true, 20971520)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "announcement_attachments_select" ON storage.objects;
CREATE POLICY "announcement_attachments_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'announcement-attachments');

DROP POLICY IF EXISTS "announcement_attachments_insert" ON storage.objects;
CREATE POLICY "announcement_attachments_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
        AND (storage.foldername(name))[1] = cm.club_id::text
    )
  );

DROP POLICY IF EXISTS "announcement_attachments_update" ON storage.objects;
CREATE POLICY "announcement_attachments_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
        AND (storage.foldername(name))[1] = cm.club_id::text
    )
  )
  WITH CHECK (
    bucket_id = 'announcement-attachments'
    AND EXISTS (
      SELECT 1 FROM public.club_members AS cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'executive')
        AND (storage.foldername(name))[1] = cm.club_id::text
    )
  );
