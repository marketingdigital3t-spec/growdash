-- Turma mutations must follow the access profile selected by the workspace
-- administrator. The structural workspace role `analyst` is also used to
-- store the UI profile `editor`, so can_edit_workspace() alone cannot tell
-- an Editor from an Analista. Keep the check in a dedicated, least-privilege
-- helper used only by the event-class RLS functions.

CREATE OR REPLACE FUNCTION public.user_can_manage_event_class_workspace(
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
    AND (SELECT auth.uid()) = _user_id
    AND (
      public.is_master(_user_id)
      OR public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.workspace_members member
        WHERE member.workspace_id = _workspace_id
          AND member.user_id = _user_id
          AND member.status = 'active'
          AND member.role IN ('owner', 'admin')
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
          AND permission.can_classes IS TRUE
      )
    );
$$;

REVOKE ALL ON FUNCTION public.user_can_manage_event_class_workspace(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_event_class_workspace(uuid, uuid) TO authenticated;

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
  SELECT
    _user_id IS NOT NULL
    AND (SELECT auth.uid()) = _user_id
    AND EXISTS (
      SELECT 1
      FROM public.ad_accounts account
      WHERE account.id = _ad_account_id
        AND (
          public.is_master(_user_id)
          OR public.has_role(_user_id, 'admin'::public.app_role)
          OR (
            account.workspace_id IS NOT NULL
            AND public.user_can_manage_event_class_workspace(account.workspace_id, _user_id)
            AND public.user_can_view_ad_account(_user_id, account.id)
          )
          OR (
            account.workspace_id IS NULL
            AND account.user_id = _user_id
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.user_can_edit_event_class_account(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_edit_event_class_account(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_access_event_class(
  _event_class_id uuid,
  _write boolean DEFAULT false,
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
      FROM public.event_classes event_class
      WHERE event_class.id = _event_class_id
        AND (
          public.is_master(_user_id)
          OR public.has_role(_user_id, 'admin'::public.app_role)
          OR (
            event_class.user_id = _user_id
            AND NOT _write
          )
          OR (
            event_class.user_id = _user_id
            AND _write
            AND (
              event_class.ad_account_id IS NULL
              OR public.user_can_edit_event_class_account(event_class.ad_account_id, _user_id)
            )
          )
          OR EXISTS (
            SELECT 1
            FROM (
              SELECT event_class.ad_account_id AS ad_account_id
              WHERE event_class.ad_account_id IS NOT NULL
              UNION
              SELECT link.ad_account_id
              FROM public.event_class_accounts link
              WHERE link.event_class_id = event_class.id
            ) linked_account
            WHERE CASE
              WHEN _write THEN public.user_can_edit_event_class_account(linked_account.ad_account_id, _user_id)
              ELSE public.user_can_view_ad_account(_user_id, linked_account.ad_account_id)
            END
          )
          OR EXISTS (
            SELECT 1
            FROM public.workspace_members owner_member
            WHERE owner_member.user_id = event_class.user_id
              AND owner_member.status = 'active'
              AND CASE
                WHEN _write THEN public.user_can_manage_event_class_workspace(owner_member.workspace_id, _user_id)
                ELSE public.is_workspace_member(owner_member.workspace_id, _user_id)
              END
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_event_class(uuid, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_event_class(uuid, boolean, uuid) TO authenticated;
