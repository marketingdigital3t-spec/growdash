-- is_master helper
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'master'::app_role
  )
$$;

-- Promote you to master
INSERT INTO public.user_roles (user_id, role)
SELECT 'b46fa882-6174-4fe1-8f62-25fa8fbc6978'::uuid, 'master'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = 'b46fa882-6174-4fe1-8f62-25fa8fbc6978'::uuid AND role = 'master'::app_role
);

-- Update handle_new_user to assign 'usuario' to new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'usuario'::app_role);
  RETURN NEW;
END;
$$;

-- Keep only PRINCIPAL - ATUALIZADO as the global view
UPDATE public.dashboard_views
SET is_system = true, is_default = true, scope = 'global', name = 'Principal'
WHERE id = '2ffa433c-55e5-463e-91d0-eabe9e8d38bc';

DELETE FROM public.dashboard_view_state
WHERE view_id <> '2ffa433c-55e5-463e-91d0-eabe9e8d38bc';

DELETE FROM public.dashboard_views
WHERE id <> '2ffa433c-55e5-463e-91d0-eabe9e8d38bc';

-- Replace RLS policies on dashboard_views
DROP POLICY IF EXISTS "Users view own views" ON public.dashboard_views;
DROP POLICY IF EXISTS "Users insert own views" ON public.dashboard_views;
DROP POLICY IF EXISTS "Users update own views" ON public.dashboard_views;
DROP POLICY IF EXISTS "Users delete own views" ON public.dashboard_views;

CREATE POLICY "Anyone authenticated can view global views"
ON public.dashboard_views
FOR SELECT
TO authenticated
USING (scope = 'global');

CREATE POLICY "Only master can insert views"
ON public.dashboard_views
FOR INSERT
TO authenticated
WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Only master can update views"
ON public.dashboard_views
FOR UPDATE
TO authenticated
USING (public.is_master(auth.uid()));

CREATE POLICY "Only master can delete views"
ON public.dashboard_views
FOR DELETE
TO authenticated
USING (public.is_master(auth.uid()));
