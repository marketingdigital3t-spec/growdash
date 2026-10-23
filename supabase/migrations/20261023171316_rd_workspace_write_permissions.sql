-- Share only non-secret RD connection metadata with active workspace members.
-- The provider token remains inaccessible; owner approval still gates enabling
-- writes, while authorized workspace editors can use the approved connection.
-- Bind legacy owner-only connections when the owner has exactly one workspace;
-- this gives the edge functions a stable workspace authorization boundary
-- without guessing when one owner belongs to several workspaces.
WITH single_workspace_owner AS (
  SELECT owner_id, (array_agg(id ORDER BY id))[1] AS workspace_id
  FROM public.workspaces
  GROUP BY owner_id
  HAVING count(*) = 1
)
UPDATE public.rd_account_connections connection
SET workspace_id = single_workspace_owner.workspace_id
FROM single_workspace_owner
WHERE connection.workspace_id IS NULL
  AND connection.user_id = single_workspace_owner.owner_id;

DROP FUNCTION IF EXISTS public.list_workspace_rd_account_connections(uuid);

CREATE OR REPLACE FUNCTION public.list_workspace_rd_account_connections(_workspace_id uuid)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  external_account_id text,
  account_name text,
  status text,
  write_enabled boolean,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  permissions jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso ao workspace negado.' USING ERRCODE = '42501';
  END IF;

  SELECT workspace.owner_id INTO _owner_id
  FROM public.workspaces workspace
  WHERE workspace.id = _workspace_id;

  RETURN QUERY
  SELECT connection.id,
         COALESCE(connection.workspace_id, _workspace_id),
         connection.external_account_id,
         connection.account_name,
         connection.status,
         connection.write_enabled,
         connection.last_attempt_at,
         connection.last_success_at,
         connection.last_error,
         connection.permissions,
         connection.created_at,
         connection.updated_at
  FROM public.rd_account_connections connection
  WHERE connection.workspace_id = _workspace_id
     OR (connection.workspace_id IS NULL AND connection.user_id = _owner_id)
  ORDER BY connection.account_name ASC, connection.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_workspace_rd_account_connections(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_rd_account_connections(uuid) TO authenticated;
