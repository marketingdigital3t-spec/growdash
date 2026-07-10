CREATE POLICY "patient_photos_update_participant_or_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'patient-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_conversation_participant(
      auth.uid(),
      (NULLIF(split_part(name, '/', 1), ''))::uuid
    )
  )
)
WITH CHECK (
  bucket_id = 'patient-photos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_conversation_participant(
      auth.uid(),
      (NULLIF(split_part(name, '/', 1), ''))::uuid
    )
  )
);