ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_code text;

CREATE OR REPLACE FUNCTION public.generate_profile_user_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    candidate := floor(100000 + random() * 900000)::int::text;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE user_code = candidate
    ) THEN
      RETURN candidate;
    END IF;

    attempts := attempts + 1;
    IF attempts >= 20 THEN
      RAISE EXCEPTION 'Could not generate a unique profile user code';
    END IF;
  END LOOP;
END;
$$;

UPDATE public.profiles
SET user_code = public.generate_profile_user_code()
WHERE user_code IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN user_code SET DEFAULT public.generate_profile_user_code(),
  ALTER COLUMN user_code SET NOT NULL,
  ADD CONSTRAINT profiles_user_code_format CHECK (user_code ~ '^[0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_code_key
  ON public.profiles (user_code);

GRANT SELECT (user_code) ON public.profiles TO authenticated;
