CREATE TABLE IF NOT EXISTS public.saved_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  position_id uuid REFERENCES public.hiring_listings(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, position_id)
);

ALTER TABLE public.saved_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own saved roles" ON public.saved_roles;
CREATE POLICY "Users can manage their own saved roles"
ON public.saved_roles FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_roles_user_id ON public.saved_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_roles_position_id ON public.saved_roles(position_id);
