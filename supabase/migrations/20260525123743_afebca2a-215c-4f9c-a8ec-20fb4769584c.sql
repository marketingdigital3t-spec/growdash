
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'master'::app_role FROM auth.users WHERE email = 'admin@admin.com'
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@admin.com')
  AND role = 'usuario';
