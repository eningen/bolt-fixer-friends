-- 文章投稿のいいねを永続化
CREATE TABLE IF NOT EXISTS public.post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_id_idx ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS post_likes_user_id_idx ON public.post_likes (user_id);

GRANT SELECT ON public.post_likes TO anon, authenticated;
GRANT INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS post_likes_public_read ON public.post_likes;
CREATE POLICY post_likes_public_read
  ON public.post_likes FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;
CREATE POLICY post_likes_insert_own
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS post_likes_delete_own ON public.post_likes;
CREATE POLICY post_likes_delete_own
  ON public.post_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
