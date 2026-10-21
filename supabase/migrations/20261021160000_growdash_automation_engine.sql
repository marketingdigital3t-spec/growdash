-- Own workflow engine foundation. Additive and workspace-scoped.
-- This schema intentionally stores workflow topology separately from secrets.

CREATE TABLE IF NOT EXISTS public.growdash_workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.growdash_automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id, version)
);

CREATE TABLE IF NOT EXISTS public.growdash_workflow_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider text NOT NULL,
  encrypted_payload text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.growdash_workflow_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.growdash_automation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  node_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','running','success','skipped','error','retrying')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growdash_workflow_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.growdash_automation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growdash_workflow_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.growdash_automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cron_expression text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','error')),
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_id)
);

CREATE TABLE IF NOT EXISTS public.growdash_workflow_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.growdash_automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  path_token text NOT NULL UNIQUE,
  secret_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.growdash_workflow_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.growdash_automation_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.growdash_automations
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_policy jsonb NOT NULL DEFAULT '{"retry":0,"fallback":"stop"}'::jsonb;

-- A run is uniquely identified by the workflow version and the triggering
-- event.  This is the database-level guard that prevents webhook retries from
-- sending a second WhatsApp message or creating a second CRM record.
ALTER TABLE public.growdash_automation_runs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS growdash_automation_runs_idempotency_idx
  ON public.growdash_automation_runs(workspace_id, automation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS growdash_workflow_versions_lookup_idx ON public.growdash_workflow_versions(workflow_id, version DESC);
CREATE INDEX IF NOT EXISTS growdash_workflow_steps_run_idx ON public.growdash_workflow_run_steps(run_id, created_at);
CREATE INDEX IF NOT EXISTS growdash_workflow_logs_run_idx ON public.growdash_workflow_logs(run_id, created_at);
CREATE INDEX IF NOT EXISTS growdash_workflow_schedule_due_idx ON public.growdash_workflow_schedules(status, next_run_at);

ALTER TABLE public.growdash_workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_workflow_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_workflow_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_workflow_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_workflow_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_workflow_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_workflow_approvals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.growdash_workflow_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growdash_workflow_credentials TO authenticated;
GRANT SELECT ON public.growdash_workflow_run_steps, public.growdash_workflow_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growdash_workflow_schedules, public.growdash_workflow_webhooks TO authenticated;
GRANT SELECT, UPDATE ON public.growdash_workflow_approvals TO authenticated;
GRANT ALL ON public.growdash_workflow_versions, public.growdash_workflow_credentials, public.growdash_workflow_run_steps, public.growdash_workflow_logs, public.growdash_workflow_schedules, public.growdash_workflow_webhooks, public.growdash_workflow_approvals TO service_role;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['growdash_workflow_versions','growdash_workflow_credentials','growdash_workflow_run_steps','growdash_workflow_logs','growdash_workflow_schedules','growdash_workflow_webhooks','growdash_workflow_approvals'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Workspace members read %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Workspace members read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id))', table_name, table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Workspace editors manage workflow versions" ON public.growdash_workflow_versions;
CREATE POLICY "Workspace editors manage workflow versions" ON public.growdash_workflow_versions FOR ALL TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
DROP POLICY IF EXISTS "Workspace editors manage workflow credentials" ON public.growdash_workflow_credentials;
CREATE POLICY "Workspace editors manage workflow credentials" ON public.growdash_workflow_credentials FOR ALL TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
DROP POLICY IF EXISTS "Workspace editors manage workflow schedules" ON public.growdash_workflow_schedules;
CREATE POLICY "Workspace editors manage workflow schedules" ON public.growdash_workflow_schedules FOR ALL TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
DROP POLICY IF EXISTS "Workspace editors manage workflow webhooks" ON public.growdash_workflow_webhooks;
CREATE POLICY "Workspace editors manage workflow webhooks" ON public.growdash_workflow_webhooks FOR ALL TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
DROP POLICY IF EXISTS "Workspace editors resolve workflow approvals" ON public.growdash_workflow_approvals;
CREATE POLICY "Workspace editors resolve workflow approvals" ON public.growdash_workflow_approvals FOR UPDATE TO authenticated USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));

COMMENT ON TABLE public.growdash_workflow_credentials IS 'Encrypted provider credentials. Values are never returned to the browser by Edge Functions.';
