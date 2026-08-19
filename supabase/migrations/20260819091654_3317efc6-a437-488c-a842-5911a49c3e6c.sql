-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- videos
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'youtube',
  youtube_id TEXT,
  thumbnail_url TEXT,
  views BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX videos_created_at_idx ON public.videos (created_at DESC);
CREATE INDEX videos_views_idx ON public.videos (views DESC);
CREATE INDEX videos_user_id_idx ON public.videos (user_id);
GRANT SELECT ON public.videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos_public_read" ON public.videos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "videos_insert_own" ON public.videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "videos_update_own" ON public.videos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "videos_delete_own" ON public.videos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- likes
CREATE TABLE public.likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id)
);
CREATE INDEX likes_video_id_idx ON public.likes (video_id);
GRANT SELECT ON public.likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_public_read" ON public.likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_name TEXT;
  final_name TEXT;
  n INT := 0;
BEGIN
  base_name := regexp_replace(lower(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user')), '[^a-z0-9_]', '', 'g');
  IF base_name = '' THEN base_name := 'user'; END IF;
  final_name := base_name;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_name) LOOP
    n := n + 1;
    final_name := base_name || n::TEXT;
  END LOOP;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, final_name, coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_name));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- view counter (public, single increment)
CREATE OR REPLACE FUNCTION public.increment_video_views(_video_id UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.videos SET views = views + 1 WHERE id = _video_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_video_views(UUID) TO anon, authenticated;