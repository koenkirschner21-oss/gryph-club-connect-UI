ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.post_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('heart', 'thumbs_up', 'laugh')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id, reaction)
);

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view reactions" ON public.post_reactions;
CREATE POLICY "Members can view reactions"
  ON public.post_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Members can add reactions" ON public.post_reactions;
CREATE POLICY "Members can add reactions"
  ON public.post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members can remove reactions" ON public.post_reactions;
CREATE POLICY "Members can remove reactions"
  ON public.post_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can log views" ON public.post_views;
CREATE POLICY "Members can log views"
  ON public.post_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Executives can see view counts" ON public.post_views;
CREATE POLICY "Executives can see view counts"
  ON public.post_views FOR SELECT
  USING (true);
