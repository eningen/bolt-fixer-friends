-- Make the RPC resilient as well: repeated sends always replace the old pending row.
-- This complements the direct-INSERT trigger for older clients.

CREATE OR REPLACE FUNCTION public.send_friend_request(p_recipient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid := auth.uid();
  v_request_id uuid;
BEGIN
  IF v_requester_id IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;
  IF p_recipient_id IS NULL OR p_recipient_id = v_requester_id THEN
    RAISE EXCEPTION '自分自身にはフレンド申請を送れません';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'ユーザーが見つかりません';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = LEAST(v_requester_id, p_recipient_id)
      AND user_b = GREATEST(v_requester_id, p_recipient_id)
  ) THEN
    RAISE EXCEPTION 'すでにフレンドです';
  END IF;

  DELETE FROM public.friend_requests
  WHERE status = 'pending'
    AND (
      (requester_id = v_requester_id AND recipient_id = p_recipient_id)
      OR
      (requester_id = p_recipient_id AND recipient_id = v_requester_id)
    );

  INSERT INTO public.friend_requests(requester_id, recipient_id, status)
  VALUES (v_requester_id, p_recipient_id, 'pending')
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
