-- Finance access is configured per workspace in the UI. Do not consult the
-- global legacy permission here: a permission granted in workspace B must not
-- allow writes in workspace A.
CREATE OR REPLACE FUNCTION public.can_manage_finance(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members member
    LEFT JOIN public.workspace_user_permissions permission
      ON permission.workspace_id = member.workspace_id
      AND permission.user_id = member.user_id
    WHERE member.workspace_id = _workspace_id
      AND member.user_id = _user_id
      AND member.status = 'active'
      AND (
        member.role IN ('owner', 'admin', 'financial')
        OR COALESCE(permission.can_finance, false)
      )
  )
$$;

COMMENT ON FUNCTION public.can_manage_finance(uuid, uuid)
  IS 'Allows finance writes for active workspace finance managers or explicitly scoped workspace permissions.';
