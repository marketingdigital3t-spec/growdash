-- A page permission must never be enough to create an unscoped class. New
-- classes need an assigned Meta account so the same Editor/account boundary
-- applies to direct Supabase writes as it does to participant mutations.

DROP POLICY IF EXISTS "Workspace editors create event_classes" ON public.event_classes;
CREATE POLICY "Workspace editors create event_classes"
  ON public.event_classes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master((SELECT auth.uid()))
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      (SELECT auth.uid()) = user_id
      AND ad_account_id IS NOT NULL
      AND (SELECT public.user_can_edit_event_class_account(ad_account_id))
    )
  );
