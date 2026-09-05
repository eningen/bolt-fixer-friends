CREATE OR REPLACE FUNCTION public.are_friends(p_other_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE (user_a = auth.uid() AND user_b = p_other_id)
       OR (user_b = auth.uid() AND user_a = p_other_id)
  );
$$;

REVOKE ALL ON FUNCTION public.are_friends(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid) TO authenticated;

DROP POLICY IF EXISTS direct_messages_insert_own ON public.direct_messages;
CREATE POLICY direct_messages_insert_own ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.are_friends(recipient_id));