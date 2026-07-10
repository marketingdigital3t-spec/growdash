
-- audit_log: permitir INSERT pelo próprio ator autenticado
CREATE POLICY audit_log_insert_self ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- user_roles: apenas admins podem escrever
CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- clinic_admins: apenas admins podem escrever
CREATE POLICY clinic_admins_insert_admin ON public.clinic_admins
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY clinic_admins_update_admin ON public.clinic_admins
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY clinic_admins_delete_admin ON public.clinic_admins
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
