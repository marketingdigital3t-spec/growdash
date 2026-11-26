-- Keep the public Editor profile and the workspace write boundary aligned.
-- Some older memberships are structurally `member` while their selected UI
-- profile is stored as `workspace_user_permissions.access_role = 'editor'`.
-- Those users must be able to write only inside their active workspace.

CREATE OR REPLACE FUNCTION public.can_edit_workspace(
  _workspace_id uuid,
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
    AND (
      EXISTS (
        SELECT 1
        FROM public.workspace_members member
        WHERE member.workspace_id = _workspace_id
          AND member.user_id = _user_id
          AND member.status = 'active'
          AND member.role IN ('owner', 'admin', 'analyst', 'financial')
      )
      OR EXISTS (
        SELECT 1
        FROM public.workspace_members member
        JOIN public.workspace_user_permissions permission
          ON permission.workspace_id = member.workspace_id
         AND permission.user_id = member.user_id
        WHERE member.workspace_id = _workspace_id
          AND member.user_id = _user_id
          AND member.status = 'active'
          AND permission.access_role = 'editor'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_workspace(uuid, uuid) TO authenticated, service_role;
