-- 1) Renomear view_password -> access_code (mantém default aleatório de 6 chars)
ALTER TABLE public.conversations RENAME COLUMN view_password TO access_code;

-- 2) RPC para renovar o código de acesso (apenas participantes)
CREATE OR REPLACE FUNCTION public.rotate_conversation_access_code(_conversation_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
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

  _new_code := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));

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

REVOKE ALL ON FUNCTION public.rotate_conversation_access_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_conversation_access_code(uuid) TO authenticated;

-- 3) Tabela de pedidos LGPD (exclusão de fotos por paciente)
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'photos' CHECK (scope IN ('photos','all')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','done')),
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  resolver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.data_deletion_requests TO authenticated;
GRANT UPDATE ON public.data_deletion_requests TO authenticated;
GRANT ALL ON public.data_deletion_requests TO service_role;

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient reads own deletion requests"
  ON public.data_deletion_requests FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "patient creates own deletion requests"
  ON public.data_deletion_requests FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "admin resolves deletion requests"
  ON public.data_deletion_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_deletion_requests_patient ON public.data_deletion_requests (patient_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.data_deletion_requests (status);

CREATE TRIGGER set_deletion_requests_updated_at
  BEFORE UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();