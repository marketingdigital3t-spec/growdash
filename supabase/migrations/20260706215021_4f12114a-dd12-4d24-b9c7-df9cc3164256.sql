
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- SEGURANÇA: cadastro público SEMPRE cria papel 'patient'.
  -- Profissionais e administradoras só podem ser criados via edge functions
  -- (bootstrap-owner ou admin-create-user), que gravam em user_roles com service role.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient'::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
