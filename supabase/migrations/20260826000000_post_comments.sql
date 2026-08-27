-- Persist the text-post comment schema in migrations so every environment
-- (including Lovable deployments) has the same table as the app expects.
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  parent_comment_id UUID NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

DROP POLICY IF EXISTS "post_comments_public_read" ON public.post_comments;
CREATE POLICY "post_comments_public_read" ON public.post_comments
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "post_comments_authenticated_insert_own" ON public.post_comments;
CREATE POLICY "post_comments_authenticated_insert_own" ON public.post_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_comments_authenticated_update_own" ON public.post_comments;
CREATE POLICY "post_comments_authenticated_update_own" ON public.post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_comments_authenticated_delete_own" ON public.post_comments;
CREATE POLICY "post_comments_authenticated_delete_own" ON public.post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON public.post_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx ON public.post_comments (user_id);
CREATE INDEX IF NOT EXISTS post_comments_parent_comment_id_idx ON public.post_comments (parent_comment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_post_comments_updated_at'
      AND tgrelid = 'public.post_comments'::regclass
  ) THEN
    CREATE TRIGGER update_post_comments_updated_at
      BEFORE UPDATE ON public.post_comments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
