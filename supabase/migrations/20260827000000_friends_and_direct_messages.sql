-- Friends and 1:1 direct messages
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'friend_request';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_not_self CHECK (requester_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS friend_requests_recipient_status_idx ON public.friend_requests(recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx ON public.friend_requests(requester_id, status, created_at DESC);
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.friend_requests TO authenticated;
GRANT UPDATE ON public.friend_requests TO authenticated;
CREATE POLICY friend_requests_select_participant ON public.friend_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY friend_requests_update_recipient ON public.friend_requests FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_ordered CHECK (user_a < user_b),
  CONSTRAINT friendships_not_self CHECK (user_a <> user_b),
  CONSTRAINT friendships_unique_pair UNIQUE (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS friendships_user_a_idx ON public.friendships(user_a);
CREATE INDEX IF NOT EXISTS friendships_user_b_idx ON public.friendships(user_b);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.friendships TO authenticated;
CREATE POLICY friendships_select_participant ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT direct_messages_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT direct_messages_body_length CHECK (char_length(trim(body)) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS direct_messages_pair_created_idx ON public.direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_created_idx ON public.direct_messages(recipient_id, sender_id, created_at DESC);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
CREATE POLICY direct_messages_select_friend ON public.direct_messages FOR SELECT TO authenticated
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  ) AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE (f.user_a = LEAST(sender_id, recipient_id) AND f.user_b = GREATEST(sender_id, recipient_id))
  );
CREATE POLICY direct_messages_insert_friend ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> recipient_id
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_a = LEAST(sender_id, recipient_id) AND f.user_b = GREATEST(sender_id, recipient_id)
    )
  );

CREATE OR REPLACE FUNCTION public.send_friend_request(p_recipient_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_requester_id uuid := auth.uid();
  v_request_id uuid;
  v_sender_name text;
  v_existing uuid;
BEGIN
  IF v_requester_id IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  IF p_recipient_id IS NULL OR p_recipient_id = v_requester_id THEN RAISE EXCEPTION '自分自身にはフレンド申請を送れません'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN RAISE EXCEPTION 'ユーザーが見つかりません'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE user_a = LEAST(v_requester_id,p_recipient_id) AND user_b = GREATEST(v_requester_id,p_recipient_id)) THEN RAISE EXCEPTION 'すでにフレンドです'; END IF;
  SELECT id INTO v_existing FROM public.friend_requests WHERE status = 'pending' AND ((requester_id = v_requester_id AND recipient_id = p_recipient_id) OR (requester_id = p_recipient_id AND recipient_id = v_requester_id)) ORDER BY created_at DESC LIMIT 1;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'フレンド申請はすでに送信されています'; END IF;
  SELECT display_name INTO v_sender_name FROM public.profiles WHERE id = v_requester_id;
  INSERT INTO public.friend_requests(requester_id, recipient_id) VALUES (v_requester_id,p_recipient_id) RETURNING id INTO v_request_id;
  INSERT INTO public.notifications(user_id,actor_id,type,metadata)
    VALUES (p_recipient_id,v_requester_id,'friend_request',jsonb_build_object('request_id',v_request_id));
  RETURN v_request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_recipient uuid := auth.uid();
  v_request public.friend_requests%ROWTYPE;
  v_a uuid;
  v_b uuid;
BEGIN
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'ログインが必要です'; END IF;
  SELECT * INTO v_request FROM public.friend_requests WHERE id = p_request_id AND recipient_id = v_recipient AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '有効なフレンド申請が見つかりません'; END IF;
  v_a := LEAST(v_request.requester_id, v_request.recipient_id);
  v_b := GREATEST(v_request.requester_id, v_request.recipient_id);
  INSERT INTO public.friendships(user_a,user_b) VALUES (v_a,v_b) ON CONFLICT (user_a,user_b) DO NOTHING;
  UPDATE public.friend_requests SET status='accepted', updated_at=now() WHERE id=p_request_id;
  UPDATE public.notifications SET read=true WHERE user_id=v_recipient AND type='friend_request' AND metadata->>'request_id'=p_request_id::text;
  INSERT INTO public.notifications(user_id,actor_id,type,metadata)
    VALUES (v_request.requester_id,v_recipient,'friend_request',jsonb_build_object('request_id',p_request_id,'accepted',true));
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.are_friends(p_other_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = LEAST(auth.uid(), p_other_id) AND user_b = GREATEST(auth.uid(), p_other_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_friend_request_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS update_friend_requests_updated_at ON public.friend_requests;
CREATE TRIGGER update_friend_requests_updated_at BEFORE UPDATE ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.update_friend_request_timestamp();
