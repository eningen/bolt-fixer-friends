-- コメントへの返信をサポート
ALTER TABLE public.comments
  ADD COLUMN parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX comments_parent_comment_id_idx
  ON public.comments(parent_comment_id, created_at ASC);
