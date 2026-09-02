-- Allow a user to send a new friend request again after a previous pending request.
-- The previous pending request is removed first, so the existing unique pending
-- index remains valid. Each new request gets a fresh notification via the trigger.

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

  -- Remove any old pending request between these two users.
  -- This permits sending a fresh request again and keeps the pending unique index valid.
  DELETE FROM public.friend_requests
  WHERE status = 'pending'
    AND (
      (requester_id = v_requester_id AND recipient_id = p_recipient_id)
      OR
      (requester_id = p_recipient_id AND recipient_id = v_requester_id)
    );

  INSERT INTO public.friend_requests(requester_id, recipient_id)
  VALUES (v_requester_id, p_recipient_id)
  RETURNING id INTO v_request_id;

  -- The INSERT trigger creates the in-app notification.
  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
