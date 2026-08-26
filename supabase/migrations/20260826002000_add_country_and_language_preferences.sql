ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS language_code TEXT NOT NULL DEFAULT 'ja';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_language_code_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_language_code_check
  CHECK (language_code IN ('ja', 'en'));

CREATE INDEX IF NOT EXISTS profiles_country_code_idx ON public.profiles (country_code);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_name TEXT;
  final_name TEXT;
  n INT := 0;
  country TEXT;
  lang TEXT;
BEGIN
  base_name := regexp_replace(lower(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user')), '[^a-z0-9_]', '', 'g');
  IF base_name = '' THEN base_name := 'user'; END IF;
  final_name := base_name;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_name) LOOP
    n := n + 1;
    final_name := base_name || n::TEXT;
  END LOOP;

  country := NULLIF(upper(NEW.raw_user_meta_data->>'country_code'), '');
  lang := CASE
    WHEN country IN ('JP') THEN 'ja'
    ELSE 'en'
  END;

  INSERT INTO public.profiles (id, username, display_name, country_code, language_code)
  VALUES (
    NEW.id,
    final_name,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_name),
    country,
    lang
  );
  RETURN NEW;
END; $$;
