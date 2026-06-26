-- AUDIT-5: Tighten overly permissive RLS (resource links, event RSVPs, hiring listings, events).

-- ─── club_resource_links ───
DROP POLICY IF EXISTS "Executives can manage resource links" ON public.club_resource_links;
DROP POLICY IF EXISTS "Executives can delete resource links" ON public.club_resource_links;

CREATE POLICY "club_resource_links_insert_manage_documents"
  ON public.club_resource_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.club_has_permission(club_id, 'manage_documents', auth.uid())
  );

CREATE POLICY "club_resource_links_delete_manage_documents"
  ON public.club_resource_links
  FOR DELETE
  TO authenticated
  USING (
    public.club_has_permission(club_id, 'manage_documents', auth.uid())
  );

-- ─── event_rsvps ───
DROP POLICY IF EXISTS "Anyone can read RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Anyone can view RSVPs" ON public.event_rsvps;
DROP POLICY IF EXISTS "Members can insert own RSVP" ON public.event_rsvps;
DROP POLICY IF EXISTS "Users can RSVP" ON public.event_rsvps;

DROP POLICY IF EXISTS "event_rsvps_select_own_or_tenant" ON public.event_rsvps;
CREATE POLICY "event_rsvps_select_own_or_tenant"
  ON public.event_rsvps
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.events AS ev
      WHERE ev.id = event_rsvps.event_id
        AND (
          ev.visibility IN ('public', 'featured')
          OR ev.club_id IN (
            SELECT cm.club_id
            FROM public.club_members AS cm
            WHERE cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
    )
  );

-- ─── hiring_listings ───
DROP POLICY IF EXISTS "Execs can create listings" ON public.hiring_listings;

DROP POLICY IF EXISTS "hiring_listings_insert_manage_hiring" ON public.hiring_listings;
CREATE POLICY "hiring_listings_insert_manage_hiring"
  ON public.hiring_listings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.club_has_permission(club_id, 'manage_hiring', auth.uid())
      OR public.is_club_president(club_id, auth.uid())
      OR public.is_club_executive(club_id, auth.uid())
    )
  );

-- ─── events ───
DROP POLICY IF EXISTS "Events are publicly readable" ON public.events;
