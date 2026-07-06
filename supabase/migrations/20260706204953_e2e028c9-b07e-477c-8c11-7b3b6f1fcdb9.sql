
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('view','edit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Usuária vê suas próprias permissões; admin vê todas
CREATE POLICY "perms_select" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
-- Só admin altera permissões
CREATE POLICY "perms_insert_admin" ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perms_update_admin" ON public.user_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "perms_delete_admin" ON public.user_permissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins também precisam listar profiles/user_roles de toda a equipe
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER user_permissions_updated
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Como esta é a primeira instalação, se ainda não existir nenhum admin, promove o primeiro usuário existente a admin (facilita bootstrap).
-- Não faz nada se já houver admin.
DO $$
DECLARE first_user UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    SELECT id INTO first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    IF first_user IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (first_user, 'admin')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
