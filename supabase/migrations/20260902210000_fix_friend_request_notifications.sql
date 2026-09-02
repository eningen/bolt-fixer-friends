-- Ensure friend requests always create exactly one in-app notification.
-- The original send_friend_request() inserted a notification itself, and a later
-- trigger also inserted one, which could cause duplicate notifications.

CREATE OR REPLACE FUNCTION public.create_friend_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications(user_id, actor_id, type, metadata)
  VALUES (
    NEW.recipient_id,
    NEW.requester_id,
    'friend_request',
    jsonb_build_object('request_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_request_notification_trigger ON public.friend_requests;
CREATE TRIGGER friend_request_notification_trigger
AFTER INSERT ON public.friend_requests
FOR EACH ROW EXECUTE FUNCTION public.create_friend_request_notification();

CREATE OR REPLACE FUNCTION public.send_friend_request(p_recipient_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_id uuid := auth.uid();
  v_request_id uuid;
  v_existing uuid;
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

  SELECT id INTO v_existing
  FROM public.friend_requests
  WHERE status = 'pending'
    AND (
      (requester_id = v_requester_id AND recipient_id = p_recipient_id)
      OR
      (requester_id = p_recipient_id AND recipient_id = v_requester_id)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'フレンド申請はすでに送信されています';
  END IF;

  INSERT INTO public.friend_requests(requester_id, recipient_id)
  VALUES (v_requester_id, p_recipient_id)
  RETURNING id INTO v_request_id;

  -- Notification is created by friend_request_notification_trigger.
  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
