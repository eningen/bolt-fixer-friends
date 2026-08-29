CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recipient uuid := auth.uid(); v_request public.friend_requests%ROWTYPE; v_a uuid; v_b uuid;
BEGIN
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  SELECT * INTO v_request FROM public.friend_requests WHERE id=p_request_id AND recipient_id=v_recipient AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '有効なフレンド申請が見つかりません'; END IF;
  v_a := LEAST(v_request.requester_id,v_request.recipient_id); v_b := GREATEST(v_request.requester_id,v_request.recipient_id);
  INSERT INTO public.friendships(user_a,user_b) VALUES(v_a,v_b) ON CONFLICT(user_a,user_b) DO NOTHING;
  UPDATE public.friend_requests SET status='accepted',updated_at=now() WHERE id=p_request_id;
  UPDATE public.notifications SET read=true, metadata=metadata || jsonb_build_object('accepted',true) WHERE user_id=v_recipient AND type='friend_request' AND metadata->>'request_id'=p_request_id::text;
  INSERT INTO public.notifications(user_id,actor_id,type,metadata) VALUES(v_request.requester_id,v_recipient,'friend_request',jsonb_build_object('request_id',p_request_id,'accepted',true));
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
