CREATE OR REPLACE FUNCTION public.ensure_conversation_access_code(_conversation_id uuid)
RETURNS TABLE(access_code text, code_day date, generated_at timestamp with time zone)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
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
    _new_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
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

REVOKE ALL ON FUNCTION public.ensure_conversation_access_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_conversation_access_code(uuid) TO authenticated;