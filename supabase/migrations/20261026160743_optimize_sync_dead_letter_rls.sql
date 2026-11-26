DROP POLICY IF EXISTS "Members view own sync dead letters" ON public.sync_event_dead_letters;
CREATE POLICY "Members view own sync dead letters"
  ON public.sync_event_dead_letters FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR public.is_workspace_member(workspace_id)
    OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
    OR (SELECT public.has_role((SELECT auth.uid()), 'master'::app_role))
  );
