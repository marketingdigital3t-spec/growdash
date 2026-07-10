
-- 1) Conversations: allow participants (and admin) to delete their conversations
DROP POLICY IF EXISTS "Participants can delete conversation" ON public.conversations;
CREATE POLICY "Participants can delete conversation"
ON public.conversations
FOR DELETE
TO authenticated
USING (
  auth.uid() = patient_id
  OR auth.uid() = professional_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2) Avatars: restrict read to owner, admin, or users who can view the profile
DROP POLICY IF EXISTS "avatars_read_auth" ON storage.objects;
CREATE POLICY "avatars_read_related"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR owner = auth.uid()
    OR public.can_view_profile(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
