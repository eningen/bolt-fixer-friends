-- live_streams
CREATE TABLE public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'preparing',
  transport text NOT NULL DEFAULT 'webrtc-p2p',
  thumbnail_url text,
  archive_path text,
  viewer_count integer NOT NULL DEFAULT 0,
  peak_viewer_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_streams_status_idx ON public.live_streams (status, started_at DESC);
CREATE INDEX live_streams_user_idx ON public.live_streams (user_id, created_at DESC);

GRANT SELECT ON public.live_streams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_streams_public_read ON public.live_streams FOR SELECT TO anon, authenticated
  USING (status IN ('live', 'ended'));
CREATE POLICY live_streams_owner_read ON public.live_streams FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY live_streams_insert_own ON public.live_streams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY live_streams_update_own ON public.live_streams FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY live_streams_delete_own ON public.live_streams FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_live_streams_updated_at BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- live_viewers
CREATE TABLE public.live_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_key text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, session_key)
);
CREATE INDEX live_viewers_stream_idx ON public.live_viewers (stream_id, last_seen_at DESC);

GRANT SELECT ON public.live_viewers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_viewers TO authenticated;
GRANT ALL ON public.live_viewers TO service_role;
ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_viewers_public_read ON public.live_viewers FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY live_viewers_insert_own ON public.live_viewers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY live_viewers_update_own ON public.live_viewers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY live_viewers_delete_own ON public.live_viewers FOR DELETE TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.user_id = auth.uid()));

-- live_chat_messages
CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_chat_messages_stream_idx ON public.live_chat_messages (stream_id, created_at DESC);

GRANT SELECT ON public.live_chat_messages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_chat_public_read ON public.live_chat_messages FOR SELECT TO anon, authenticated
  USING (hidden = false);
CREATE POLICY live_chat_owner_read ON public.live_chat_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.user_id = auth.uid()));
CREATE POLICY live_chat_insert_own ON public.live_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY live_chat_update_host ON public.live_chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.user_id = auth.uid()));
CREATE POLICY live_chat_delete_own ON public.live_chat_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.user_id = auth.uid()));

-- live_likes
CREATE TABLE public.live_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stream_id, user_id)
);
CREATE INDEX live_likes_stream_idx ON public.live_likes (stream_id);

GRANT SELECT ON public.live_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.live_likes TO authenticated;
GRANT ALL ON public.live_likes TO service_role;
ALTER TABLE public.live_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_likes_public_read ON public.live_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY live_likes_insert_own ON public.live_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY live_likes_delete_own ON public.live_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- live_signals (WebRTC signaling relay)
CREATE TABLE public.live_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_key text NOT NULL,
  recipient_key text,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_signals_stream_idx ON public.live_signals (stream_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.live_signals TO authenticated;
GRANT ALL ON public.live_signals TO service_role;
ALTER TABLE public.live_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY live_signals_read ON public.live_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY live_signals_insert ON public.live_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY live_signals_delete_host ON public.live_signals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.user_id = auth.uid()));

-- realtime
ALTER TABLE public.live_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.live_viewers REPLICA IDENTITY FULL;
ALTER TABLE public.live_streams REPLICA IDENTITY FULL;
ALTER TABLE public.live_signals REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_signals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;