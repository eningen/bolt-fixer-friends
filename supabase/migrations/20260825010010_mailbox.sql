CREATE TABLE public.mailbox_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.mailbox_messages TO authenticated;
GRANT ALL ON public.mailbox_messages TO service_role;
ALTER TABLE public.mailbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY mailbox_select_own ON public.mailbox_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY mailbox_update_own ON public.mailbox_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY mailbox_delete_own ON public.mailbox_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX mailbox_user_created_idx ON public.mailbox_messages(user_id, created_at DESC);

CREATE TRIGGER update_mailbox_messages_updated_at
  BEFORE UPDATE ON public.mailbox_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mailbox_messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_announcement(p_title text, p_body text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND username = 'tetta_art'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF length(trim(coalesce(p_title, ''))) = 0 OR length(trim(coalesce(p_body, ''))) = 0 THEN
    RAISE EXCEPTION 'title and body are required';
  END IF;

  INSERT INTO public.mailbox_messages (user_id, title, body)
  SELECT id, trim(p_title), trim(p_body)
  FROM public.profiles;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_announcement(text, text) TO authenticated;
