-- =============================================================
-- Migration: Restrict announcements channel to admin/exec only
-- =============================================================
-- Previously, the "Club members can send messages" policy allowed
-- any active club member to INSERT messages to ANY channel,
-- including "announcements".  This was a security gap — regular
-- members could bypass the frontend guard and post announcements
-- via the Supabase REST API.
--
-- This migration replaces the single INSERT policy with two:
--   1. Active members can post to non-announcements channels
--      (currently only "general").
--   2. Only admin/exec members can post to the "announcements"
--      channel.
--
-- The existing SELECT policy is left unchanged — all active
-- members can still READ messages in every channel.
--
-- Idempotent: uses DROP POLICY IF EXISTS before each CREATE.
-- =============================================================

-- Drop the old blanket INSERT policy
DROP POLICY IF EXISTS "Club members can send messages" ON public.messages;

-- Drop the new policies too (idempotent re-run safety)
DROP POLICY IF EXISTS "Active members can send non-announcement messages" ON public.messages;
DROP POLICY IF EXISTS "Admins and execs can send announcements" ON public.messages;

-- 1. Any active member can post to non-announcement channels
CREATE POLICY "Active members can send non-announcement messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND channel IS DISTINCT FROM 'announcements'
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

-- 2. Only admin/exec can post to the announcements channel
CREATE POLICY "Admins and execs can send announcements"
  ON public.messages FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND channel = 'announcements'
    AND EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = messages.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('admin', 'exec')
    )
  );
