-- Read: any authenticated user can read avatars (needed to render photo in lists)
CREATE POLICY "avatars_read_auth"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Write: only admin/professional can upload/update/delete
CREATE POLICY "avatars_insert_staff"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professional'))
);

CREATE POLICY "avatars_update_staff"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professional'))
);

CREATE POLICY "avatars_delete_staff"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'professional'))
);