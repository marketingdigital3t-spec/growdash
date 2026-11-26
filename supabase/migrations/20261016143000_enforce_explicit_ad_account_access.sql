-- Enforce explicit account assignments for delegated workspace users.
--
-- 20260928103000_restore_meta_workspace_visibility restored visibility for
-- every active workspace member. That made an Editor see all Meta accounts in
-- the workspace, even when the owner selected only a subset in the access
-- profile. Owners/admins keep workspace-wide visibility; delegated users
-- require a row in user_ad_account_access for each account.

CREATE OR REPLACE FUNCTION public.user_can_view_ad_account(
  _user_id uuid,
  _ad_account_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ad_accounts account
    WHERE account.id = _ad_account_id
      AND COALESCE((account.metadata ->> 'profile_disconnected')::boolean, false) IS NOT TRUE
      AND (
        public.is_master(_user_id)
        OR public.user_owns_ad_account(_user_id, account.id)
        OR (
          account.workspace_id IS NOT NULL
          AND public.can_manage_workspace(account.workspace_id, _user_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_ad_account_access access
          WHERE access.user_id = _user_id
            AND access.ad_account_id = account.id
            AND (
              access.workspace_id = account.workspace_id
              OR (access.workspace_id IS NULL AND account.workspace_id IS NULL)
            )
            AND (
              account.workspace_id IS NULL
              OR public.is_workspace_member(account.workspace_id, _user_id)
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_view_ad_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_view_ad_account(uuid, uuid) TO authenticated, service_role;

-- Class mutations must follow the same explicit account scope. The previous
-- helper treated every Editor in a workspace as an editor of every account.
CREATE OR REPLACE FUNCTION public.user_can_edit_event_class_account(
  _ad_account_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ad_accounts account
    WHERE account.id = _ad_account_id
      AND (
        public.is_master(_user_id)
        OR public.has_role(_user_id, 'admin'::public.app_role)
        OR (
          account.workspace_id IS NOT NULL
          AND public.can_manage_workspace(account.workspace_id, _user_id)
        )
        OR (
          account.workspace_id IS NOT NULL
          AND public.can_edit_workspace(account.workspace_id, _user_id)
          AND public.user_can_view_ad_account(_user_id, account.id)
        )
        OR (
          account.workspace_id IS NULL
          AND account.user_id = _user_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_edit_event_class_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_edit_event_class_account(uuid, uuid) TO authenticated, service_role;
