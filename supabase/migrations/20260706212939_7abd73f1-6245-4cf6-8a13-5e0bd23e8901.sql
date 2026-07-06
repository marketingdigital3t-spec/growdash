
REVOKE EXECUTE ON FUNCTION public.sync_clinic_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_clinic_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
