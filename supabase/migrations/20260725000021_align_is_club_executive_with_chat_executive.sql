-- Align is_club_executive with is_club_chat_executive so group chat creation
-- (conversations_insert_club_member) uses the same executive definition as
-- Executive Team provisioning: role IN (owner, executive, admin, exec) OR
-- access_level IN (president, managerial_executive, executive).

CREATE OR REPLACE FUNCTION public.is_club_executive(
  p_club_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_club_chat_executive(p_club_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_club_executive(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
