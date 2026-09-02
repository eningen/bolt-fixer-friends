CREATE TABLE IF NOT EXISTS public.admin_badges (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_badges TO anon, authenticated;
GRANT ALL ON public.admin_badges TO service_role;
ALTER TABLE public.admin_badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_badges_public_read ON public.admin_badges;
CREATE POLICY admin_badges_public_read ON public.admin_badges FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS private.admin_master (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  password_hash text NOT NULL
);
REVOKE ALL ON private.admin_master FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_number_for(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lpad(rn::text, 4, '0') FROM (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM public.profiles
  ) ranked WHERE ranked.id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_login(p_admin_id text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  v_hash text;
  v_number text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_number := public.admin_number_for(auth.uid());
  IF v_number IS NULL OR v_number <> trim(p_admin_id) THEN
    RAISE EXCEPTION 'unknown_admin';
  END IF;

  SELECT password_hash INTO v_hash FROM private.admin_master WHERE id;
  IF v_hash IS NULL OR v_hash <> extensions.crypt(p_password, v_hash) THEN
    RETURN false;
  END IF;

  INSERT INTO private.admin_users (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  INSERT INTO public.admin_badges (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_number_for(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_number_for(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO authenticated;