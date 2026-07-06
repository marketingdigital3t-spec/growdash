
-- Restringe execução das SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
-- has_role e is_conversation_participant são usadas em policies com auth.uid(); manter execute para authenticated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

-- Storage: bucket patient-photos é PRIVADO. Nenhuma policy client-side, só service_role acessa (edge functions).
-- Bloqueamos explicitamente qualquer operação de authenticated/anon nesse bucket.
CREATE POLICY "patient_photos_deny_select" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id <> 'patient-photos');
CREATE POLICY "patient_photos_deny_insert" ON storage.objects FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id <> 'patient-photos');
CREATE POLICY "patient_photos_deny_update" ON storage.objects FOR UPDATE TO authenticated, anon
  USING (bucket_id <> 'patient-photos');
CREATE POLICY "patient_photos_deny_delete" ON storage.objects FOR DELETE TO authenticated, anon
  USING (bucket_id <> 'patient-photos');
