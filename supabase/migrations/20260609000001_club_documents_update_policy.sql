CREATE POLICY "Club members can update their club documents"
ON club_documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM club_members
    WHERE club_members.club_id = club_documents.club_id
    AND club_members.user_id = auth.uid()
    AND club_members.role IN ('owner', 'executive')
  )
);
