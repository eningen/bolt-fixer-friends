CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscriber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, channel_id),
  CONSTRAINT subscriptions_no_self CHECK (subscriber_id <> channel_id)
);

CREATE INDEX subscriptions_channel_created_idx ON public.subscriptions (channel_id, created_at);

GRANT SELECT ON public.subscriptions TO anon;
GRANT SELECT, INSERT, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_public_read" ON public.subscriptions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "subscriptions_insert_own" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "subscriptions_delete_own" ON public.subscriptions FOR DELETE TO authenticated USING (auth.uid() = subscriber_id);