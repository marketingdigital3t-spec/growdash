CREATE TABLE IF NOT EXISTS public.conversation_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_code text NOT NULL,
  code_day date NOT NULL,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversation_access_codes_unique_user UNIQUE (conversation_id, user_id),
  CONSTRAINT conversation_access_codes_format CHECK (access_code ~ '^[A-F0-9]{6}$')
);

GRANT SELECT ON public.conversation_access_codes TO authenticated;
GRANT ALL ON public.conversation_access_codes TO service_role;

ALTER TABLE public.conversation_access_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own conversation access code" ON public.conversation_access_codes;
CREATE POLICY "Users can read own conversation access code"
ON public.conversation_access_codes
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND public.is_conversation_participant(auth.uid(), conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_access_codes_user
ON public.conversation_access_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_access_codes_conversation
ON public.conversation_access_codes (conversation_id);

CREATE OR REPLACE FUNCTION public.current_chat_code_day()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ((now() AT TIME ZONE 'America/Sao_Paulo') - interval '3 hours')::date;
$$;

CREATE OR REPLACE FUNCTION public.generate_chat_access_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
$$;

CREATE OR REPLACE FUNCTION public.ensure_conversation_access_code(_conversation_id uuid)
RETURNS TABLE(access_code text, code_day date, generated_at timestamp with time zone)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _day date := public.current_chat_code_day();
  _existing public.conversation_access_codes%ROWTYPE;
  _new_code text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.is_conversation_participant(_user_id, _conversation_id) THEN
    RAISE EXCEPTION 'not_conversation_participant';
  END IF;

  SELECT * INTO _existing
  FROM public.conversation_access_codes cac
  WHERE cac.conversation_id = _conversation_id
    AND cac.user_id = _user_id
  FOR UPDATE;

  IF FOUND AND _existing.code_day = _day THEN
    RETURN QUERY SELECT _existing.access_code, _existing.code_day, _existing.generated_at;
    RETURN;
  END IF;

  LOOP
    _new_code := public.generate_chat_access_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.conversation_access_codes cac
      WHERE cac.conversation_id = _conversation_id
        AND cac.code_day = _day
        AND cac.access_code = _new_code
    );
  END LOOP;

  INSERT INTO public.conversation_access_codes (conversation_id, user_id, access_code, code_day, generated_at, updated_at)
  VALUES (_conversation_id, _user_id, _new_code, _day, now(), now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    access_code = excluded.access_code,
    code_day = excluded.code_day,
    generated_at = excluded.generated_at,
    updated_at = now()
  RETURNING conversation_access_codes.access_code,
            conversation_access_codes.code_day,
            conversation_access_codes.generated_at
  INTO access_code, code_day, generated_at;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_chat_code_day() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_chat_access_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_conversation_access_code(uuid) TO authenticated;

DROP TRIGGER IF EXISTS set_conversation_access_codes_updated_at ON public.conversation_access_codes;
CREATE TRIGGER set_conversation_access_codes_updated_at
BEFORE UPDATE ON public.conversation_access_codes
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();