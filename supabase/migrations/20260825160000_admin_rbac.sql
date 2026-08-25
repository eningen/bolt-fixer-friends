-- Store application roles outside the user-editable profile row.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.admin_users FROM anon, authenticated;
GRANT ALL ON TABLE private.admin_users TO service_role;

-- Bootstrap the existing Stickman video operator account once.
-- The role is tied to the Auth/Profile UUID, not the editable username.
INSERT INTO private.admin_users (user_id)
SELECT id
FROM public.profiles
WHERE username = 'tetta_art'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.admin_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- Replace the old username-based authorization with the immutable user-id role.
CREATE OR REPLACE FUNCTION public.publish_announcement(p_title text, p_body text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  IF NOT public.is_current_user_admin() THEN
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

REVOKE ALL ON FUNCTION public.publish_announcement(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_announcement(text, text) TO authenticated;
