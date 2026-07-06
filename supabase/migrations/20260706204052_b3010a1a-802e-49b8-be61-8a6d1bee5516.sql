
-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'professional', 'patient');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- patient_links: vínculo explícito paciente <-> profissional
CREATE TABLE public.patient_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, professional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_links TO authenticated;
GRANT ALL ON public.patient_links TO service_role;
ALTER TABLE public.patient_links ENABLE ROW LEVEL SECURITY;

-- conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, professional_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('text','photo')),
  body TEXT,
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- lgpd_consents
CREATE TABLE public.lgpd_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT
);
GRANT SELECT, INSERT ON public.lgpd_consents TO authenticated;
GRANT ALL ON public.lgpd_consents TO service_role;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;

-- audit_log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Função utilitária: verifica se usuário participa de uma conversa
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id
      AND (c.patient_id = _user_id OR c.professional_id = _user_id)
  )
$$;

-- Trigger: cria profile ao criar usuário. Se metadata trouxer role=patient, cria user_roles patient (default). Senão nada.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  desired_role TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  desired_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  IF desired_role IN ('patient','professional','admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, desired_role::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== RLS Policies =====

-- profiles: qualquer autenticado lê profile básico (nome), próprio user edita
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles: usuário vê seus próprios papéis; admin vê todos
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- patient_links: profissional vê/gerencia seus vínculos, paciente vê seus vínculos, admin tudo
CREATE POLICY "patient_links_select" ON public.patient_links FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR professional_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "patient_links_insert_prof" ON public.patient_links FOR INSERT TO authenticated
  WITH CHECK (professional_id = auth.uid() AND public.has_role(auth.uid(), 'professional'));
CREATE POLICY "patient_links_delete_prof" ON public.patient_links FOR DELETE TO authenticated
  USING (professional_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- conversations: apenas participantes; profissional cria
CREATE POLICY "conversations_select_participant" ON public.conversations FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR professional_id = auth.uid());
CREATE POLICY "conversations_insert_prof" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (professional_id = auth.uid() AND public.has_role(auth.uid(), 'professional')
              AND EXISTS (SELECT 1 FROM public.patient_links pl
                          WHERE pl.professional_id = auth.uid() AND pl.patient_id = conversations.patient_id));
CREATE POLICY "conversations_update_participant" ON public.conversations FOR UPDATE TO authenticated
  USING (patient_id = auth.uid() OR professional_id = auth.uid());

-- messages: apenas participantes da conversation
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(auth.uid(), conversation_id));
CREATE POLICY "messages_insert_participant" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(auth.uid(), conversation_id));
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- lgpd_consents: só o próprio
CREATE POLICY "consents_select_own" ON public.lgpd_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "consents_insert_own" ON public.lgpd_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- audit_log: admin lê, service_role escreve (usuário comum não lê)
CREATE POLICY "audit_admin_select" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
