-- Allow admins to create conversations with any patient, and keep professional link check
DROP POLICY IF EXISTS "conversations_insert_prof" ON public.conversations;

CREATE POLICY "conversations_insert_prof"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  professional_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'professional'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.patient_links pl
        WHERE pl.professional_id = auth.uid()
          AND pl.patient_id = conversations.patient_id
      )
    )
  )
);

-- Also allow admins to insert patient_links (used to auto-link when creating chat)
DROP POLICY IF EXISTS "patient_links_insert_prof" ON public.patient_links;
CREATE POLICY "patient_links_insert_prof"
ON public.patient_links
FOR INSERT
TO authenticated
WITH CHECK (
  professional_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'professional'::public.app_role)
  )
);