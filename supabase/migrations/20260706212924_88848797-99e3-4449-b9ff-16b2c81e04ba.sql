
-- === Chaves E2E por usuário ===
CREATE TABLE public.user_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key jsonb NOT NULL,
  encrypted_private_key text NOT NULL,
  salt text NOT NULL,
  iv text NOT NULL,
  iterations integer NOT NULL DEFAULT 600000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_keys TO authenticated;
GRANT ALL ON public.user_keys TO service_role;
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public keys readable by authenticated"
  ON public.user_keys FOR SELECT TO authenticated USING (true);
CREATE POLICY "user inserts own key"
  ON public.user_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user updates own key"
  ON public.user_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_user_keys_updated_at
  BEFORE UPDATE ON public.user_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === Chaves de conversa (wrapped) por destinatário ===
CREATE TABLE public.conversation_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_key text NOT NULL,
  is_admin_escrow boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, recipient_id)
);
GRANT SELECT, INSERT, DELETE ON public.conversation_keys TO authenticated;
GRANT ALL ON public.conversation_keys TO service_role;
ALTER TABLE public.conversation_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient reads own wrap"
  ON public.conversation_keys FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());
CREATE POLICY "participant inserts wraps"
  ON public.conversation_keys FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(auth.uid(), conversation_id));
CREATE POLICY "recipient deletes own wrap"
  ON public.conversation_keys FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- === Adiciona IV/ciphertext em mensagens (para texto E2E) ===
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS iv text,
  ADD COLUMN IF NOT EXISTS ciphertext text;

-- === Lista de admins da clínica (para escrow automático) ===
CREATE TABLE public.clinic_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinic_admins TO authenticated;
GRANT ALL ON public.clinic_admins TO service_role;
ALTER TABLE public.clinic_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read admins"
  ON public.clinic_admins FOR SELECT TO authenticated USING (true);

INSERT INTO public.clinic_admins (user_id)
SELECT user_id FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_clinic_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.clinic_admins (user_id) VALUES (NEW.user_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_sync_clinic_admin
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_clinic_admin();

CREATE OR REPLACE FUNCTION public.remove_clinic_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    DELETE FROM public.clinic_admins WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_remove_clinic_admin
  AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.remove_clinic_admin();

-- === Eventos de segurança (login, MFA, visualização, tentativas suspeitas) ===
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip inet,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user inserts own events"
  ON public.security_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all events"
  ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_security_events_user_created ON public.security_events (user_id, created_at DESC);
CREATE INDEX idx_conversation_keys_recipient ON public.conversation_keys (recipient_id);
