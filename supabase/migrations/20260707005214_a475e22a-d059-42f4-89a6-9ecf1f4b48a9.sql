
-- ============ profiles ============
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;

CREATE OR REPLACE FUNCTION public.can_view_profile(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _viewer = _target
    OR public.has_role(_viewer, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE (c.patient_id = _viewer AND c.professional_id = _target)
         OR (c.professional_id = _viewer AND c.patient_id = _target)
    )
    OR EXISTS (
      SELECT 1 FROM public.patient_links pl
      WHERE (pl.patient_id = _viewer AND pl.professional_id = _target)
         OR (pl.professional_id = _viewer AND pl.patient_id = _target)
    )
$$;

CREATE POLICY "profiles_select_related"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.can_view_profile(auth.uid(), id));

-- ============ clinic_admins ============
DROP POLICY IF EXISTS "authenticated read admins" ON public.clinic_admins;

CREATE POLICY "clinic_admins_select_admin_or_self"
  ON public.clinic_admins FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============ user_keys ============
DROP POLICY IF EXISTS "public keys readable by authenticated" ON public.user_keys;

CREATE POLICY "user_keys_select_related"
  ON public.user_keys FOR SELECT
  TO authenticated
  USING (public.can_view_profile(auth.uid(), user_id));

-- ============ storage.objects for patient-photos ============
DROP POLICY IF EXISTS "patient_photos_deny_select" ON storage.objects;
DROP POLICY IF EXISTS "patient_photos_deny_insert" ON storage.objects;
DROP POLICY IF EXISTS "patient_photos_deny_update" ON storage.objects;
DROP POLICY IF EXISTS "patient_photos_deny_delete" ON storage.objects;

-- First path segment is the conversation_id (see upload-photo edge function).
CREATE POLICY "patient_photos_select_participant_or_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'patient-photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_conversation_participant(
           auth.uid(),
           NULLIF(split_part(name, '/', 1), '')::uuid
         )
    )
  );

CREATE POLICY "patient_photos_insert_participant"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patient-photos'
    AND public.is_conversation_participant(
          auth.uid(),
          NULLIF(split_part(name, '/', 1), '')::uuid
        )
  );

CREATE POLICY "patient_photos_delete_participant_or_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'patient-photos'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_conversation_participant(
           auth.uid(),
           NULLIF(split_part(name, '/', 1), '')::uuid
         )
    )
  );
