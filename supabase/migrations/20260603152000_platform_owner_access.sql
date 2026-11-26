CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = _user_id
      AND lower(u.email) = 'marketingdigital3t@gmail.com'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_owner(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'master'::app_role
    )
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'master'::app_role
FROM auth.users u
WHERE lower(u.email) = 'marketingdigital3t@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (
  user_id,
  username,
  can_dashboard,
  can_campaigns,
  can_funnels,
  can_classes
)
SELECT
  u.id,
  'marketingdigital3t',
  true,
  true,
  true,
  true
FROM auth.users u
WHERE lower(u.email) = 'marketingdigital3t@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  username = EXCLUDED.username,
  can_dashboard = true,
  can_campaigns = true,
  can_funnels = true,
  can_classes = true,
  updated_at = now();
