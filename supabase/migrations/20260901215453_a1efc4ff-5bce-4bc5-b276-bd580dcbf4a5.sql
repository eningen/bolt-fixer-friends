
-- AI comment flags
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS is_ai boolean NOT NULL DEFAULT false;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS ai_model text;

-- Comments on text posts
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_comments_public_read ON public.post_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY post_comments_insert_own ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY post_comments_delete_own ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Friend requests / friendships
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_uniq ON public.friend_requests (requester_id, recipient_id) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY friend_requests_read_own ON public.friend_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);
CREATE POLICY friend_requests_insert_own ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY friend_requests_update_recipient ON public.friend_requests FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE POLICY friend_requests_delete_own ON public.friend_requests FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a < user_b)
);
GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY friendships_read_own ON public.friendships FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY friendships_insert_own ON public.friendships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY friendships_delete_own ON public.friendships FOR DELETE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY direct_messages_read_own ON public.direct_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY direct_messages_insert_own ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY direct_messages_update_recipient ON public.direct_messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
CREATE POLICY direct_messages_delete_own ON public.direct_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Mailbox / announcements
CREATE TABLE IF NOT EXISTS public.mailbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.mailbox_messages TO authenticated;
GRANT ALL ON public.mailbox_messages TO service_role;
ALTER TABLE public.mailbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY mailbox_messages_read_own ON public.mailbox_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY mailbox_messages_update_own ON public.mailbox_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY mailbox_messages_delete_own ON public.mailbox_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admin credentials + login verification
CREATE TABLE IF NOT EXISTS private.admin_credentials (
  admin_id text PRIMARY KEY,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.verify_admin_login(p_admin_id text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT password_hash INTO v_hash FROM private.admin_credentials WHERE admin_id = p_admin_id;
  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'unknown_admin';
  END IF;

  IF v_hash <> extensions.crypt(p_password, v_hash) THEN
    RETURN false;
  END IF;

  INSERT INTO private.admin_users (user_id)
  VALUES (auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_admin_login(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO authenticated;
