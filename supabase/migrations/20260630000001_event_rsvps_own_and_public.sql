-- Allow users to read/write their own RSVPs regardless of club membership,
-- and to RSVP to public/featured events without being a club member.

DROP POLICY IF EXISTS "event_rsvps_select_tenant" ON public.event_rsvps;
DROP POLICY IF EXISTS "event_rsvps_insert_active_member" ON public.event_rsvps;

CREATE POLICY "event_rsvps_select_own_or_tenant"
  ON public.event_rsvps FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events AS ev
      WHERE ev.id = event_rsvps.event_id
        AND ev.club_id IN (
          SELECT cm.club_id
          FROM public.club_members AS cm
          WHERE cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
    )
  );

CREATE POLICY "event_rsvps_insert_public_or_member"
  ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.events AS ev
        WHERE ev.id = event_rsvps.event_id
          AND ev.visibility IN ('public', 'featured')
      )
      OR EXISTS (
        SELECT 1 FROM public.events AS ev
        WHERE ev.id = event_rsvps.event_id
          AND ev.club_id IN (
            SELECT cm.club_id
            FROM public.club_members AS cm
            WHERE cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
      )
    )
  );
