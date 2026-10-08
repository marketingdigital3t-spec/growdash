ALTER TABLE public.workspace_user_permissions
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'viewer'
  CHECK (access_role IN ('admin', 'editor', 'viewer', 'financial', 'analyst'));

COMMENT ON COLUMN public.workspace_user_permissions.access_role IS 'UI access profile selected by the workspace administrator; page booleans remain the final grants.';
