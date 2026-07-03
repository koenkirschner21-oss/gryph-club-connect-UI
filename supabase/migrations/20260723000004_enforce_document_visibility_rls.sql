-- Enforce document visibility tiers at the RLS layer.

ALTER TABLE public.club_documents DROP CONSTRAINT IF EXISTS club_documents_visibility_check;
ALTER TABLE public.club_documents ADD CONSTRAINT club_documents_visibility_check
  CHECK (visibility IN ('public', 'members_only', 'executives_only'));

DROP POLICY IF EXISTS "Club members can view documents" ON public.club_documents;
DROP POLICY IF EXISTS "club_documents_select_visibility" ON public.club_documents;

CREATE POLICY "club_documents_select_visibility"
  ON public.club_documents
  FOR SELECT
  TO authenticated, anon
  USING (
    COALESCE(visibility, 'members_only') = 'public'
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'members_only') = 'members_only'
      AND public.is_active_club_member(club_id, auth.uid())
    )
    OR (
      auth.uid() IS NOT NULL
      AND COALESCE(visibility, 'members_only') = 'executives_only'
      AND (
        public.club_member_is_executive_or_above(club_id, auth.uid())
        OR public.club_has_permission(club_id, 'manage_documents', auth.uid())
      )
    )
  );
