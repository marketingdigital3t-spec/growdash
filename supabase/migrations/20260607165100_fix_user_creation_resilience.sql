ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'usuario';

ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS can_crm BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_commercial BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_leads BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_alerts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_users BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_integrations BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_announcements BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_automations BOOLEAN NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ad_account_access TO authenticated;
GRANT ALL ON public.user_ad_account_access TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_rd_funnel_access TO authenticated;
GRANT ALL ON public.user_rd_funnel_access TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE
        WHEN COALESCE(EXCLUDED.full_name, '') <> '' THEN EXCLUDED.full_name
        ELSE public.profiles.full_name
      END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (user_id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::app_role
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;
