CREATE OR REPLACE FUNCTION public.user_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.user_conversation_ids() TO authenticated;

DROP POLICY IF EXISTS "conversation_members_select" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view conversation members" ON public.conversation_members;

CREATE POLICY "Users can view own membership"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view co-members"
  ON public.conversation_members
  FOR SELECT
  TO authenticated
  USING (conversation_id IN (SELECT public.user_conversation_ids()));
