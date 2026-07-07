
REVOKE ALL ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO authenticated, service_role;
