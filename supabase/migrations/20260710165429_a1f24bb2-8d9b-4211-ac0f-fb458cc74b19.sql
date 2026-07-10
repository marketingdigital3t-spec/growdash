
-- Alfabeto sem 0,O,1,I,L
CREATE OR REPLACE FUNCTION public.generate_unambiguous_code(_len int DEFAULT 6)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  result text := '';
  i int;
  b bytea;
BEGIN
  b := extensions.gen_random_bytes(_len);
  FOR i IN 0.._len-1 LOOP
    result := result || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Atualiza default
ALTER TABLE public.conversations
  ALTER COLUMN access_code SET DEFAULT public.generate_unambiguous_code(6);

-- Reescreve rotate function
CREATE OR REPLACE FUNCTION public.rotate_conversation_access_code(_conversation_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _new_code text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.is_conversation_participant(_user_id, _conversation_id) THEN
    RAISE EXCEPTION 'not_conversation_participant';
  END IF;

  _new_code := public.generate_unambiguous_code(6);

  UPDATE public.conversations
     SET access_code = _new_code,
         updated_at = now()
   WHERE id = _conversation_id;

  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (_user_id, 'conversation_access_code_rotated', 'conversation', _conversation_id,
          jsonb_build_object('rotated_at', now()));

  RETURN _new_code;
END;
$$;

-- Reemite códigos que contenham caracteres ambíguos
UPDATE public.conversations
   SET access_code = public.generate_unambiguous_code(6)
 WHERE access_code ~ '[0O1IL]' OR access_code IS NULL OR length(access_code) <> 6;
