-- Allow members to refresh viewed_at when re-reading an announcement (upsert on conflict).

DROP POLICY IF EXISTS "Members can update own views" ON public.post_views;
CREATE POLICY "Members can update own views"
  ON public.post_views FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
