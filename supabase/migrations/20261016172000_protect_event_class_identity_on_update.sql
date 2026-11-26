-- Prevent delegated Editors from moving a class to another owner or out of
-- their assigned Meta-account scope through a direct UPDATE.

CREATE OR REPLACE FUNCTION public.user_can_update_event_class_identity(
  _event_class_id uuid,
  _new_user_id uuid,
  _new_ad_account_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (SELECT auth.uid()) = _user_id
    AND EXISTS (
      SELECT 1
      FROM public.event_classes current_class
      WHERE current_class.id = _event_class_id
        AND (
          public.is_master(_user_id)
          OR public.has_role(_user_id, 'admin'::public.app_role)
          OR (
            current_class.user_id = _new_user_id
            AND _new_ad_account_id IS NOT NULL
            AND public.user_can_edit_event_class_account(_new_ad_account_id, _user_id)
          )
          OR (
            current_class.user_id = _user_id
            AND current_class.ad_account_id IS NULL
            AND _new_user_id = _user_id
            AND _new_ad_account_id IS NULL
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.user_can_update_event_class_identity(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_update_event_class_identity(uuid, uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Workspace editors update event_classes" ON public.event_classes;
CREATE POLICY "Workspace editors update event_classes"
  ON public.event_classes FOR UPDATE TO authenticated
  USING ((SELECT public.user_can_access_event_class(id, true)))
  WITH CHECK ((SELECT public.user_can_update_event_class_identity(id, user_id, ad_account_id)));
