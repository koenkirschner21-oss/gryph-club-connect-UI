-- Executives can manage all club hiring listings (not only open ones they created).
-- DELETE cascades to hiring_applications and saved_roles via existing FKs.

DROP POLICY IF EXISTS "Executives can view club hiring listings" ON public.hiring_listings;
CREATE POLICY "Executives can view club hiring listings"
  ON public.hiring_listings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = hiring_listings.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          cm.role IN ('owner', 'executive', 'exec')
          OR cm.access_level IN ('president', 'managerial_executive', 'executive')
        )
    )
  );

DROP POLICY IF EXISTS "Executives can delete club hiring listings" ON public.hiring_listings;
CREATE POLICY "Executives can delete club hiring listings"
  ON public.hiring_listings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.club_members cm
      WHERE cm.club_id = hiring_listings.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          cm.role IN ('owner', 'executive', 'exec')
          OR cm.access_level IN ('president', 'managerial_executive', 'executive')
        )
    )
  );
