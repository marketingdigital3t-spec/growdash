-- Profile-level Meta disconnect is non-destructive: keep historical facts,
-- but make every account from that profile invisible to authenticated clients.
CREATE OR REPLACE FUNCTION public.user_can_view_ad_account(_user_id uuid, _ad_account_id uuid)
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
