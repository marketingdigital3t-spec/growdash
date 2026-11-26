-- Agent Office governance. Additive, append-oriented and owner-private.
-- Agents may prepare findings/proposals, but never deploy or approve themselves.

CREATE TABLE IF NOT EXISTS public.agent_office_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('ceo', 'backend_security', 'backend_meta_rd', 'frontend', 'designer')),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'blocked')),
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, role)
);

CREATE TABLE IF NOT EXISTS public.agent_office_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  trigger text NOT NULL DEFAULT 'cron' CHECK (trigger IN ('cron', 'manual')),
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('detected', 'investigating', 'patch_ready', 'tests_passed', 'awaiting_approval', 'deployed', 'rejected', 'blocked', 'rolled_back', 'success', 'partial', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary text,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lock_key text NOT NULL,
  UNIQUE (workspace_id, lock_key)
);

CREATE TABLE IF NOT EXISTS public.agent_office_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.agent_office_runs(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.agent_office_agents(id) ON DELETE RESTRICT,
  task_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'patch_ready', 'tests_passed', 'awaiting_approval', 'deployed', 'rejected', 'blocked', 'rolled_back')),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_office_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.agent_office_runs(id) ON DELETE RESTRICT,
  agent_id uuid REFERENCES public.agent_office_agents(id) ON DELETE RESTRICT,
  fingerprint text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  category text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'patch_ready', 'tests_passed', 'awaiting_approval', 'deployed', 'rejected', 'blocked', 'rolled_back')),
  account_id text,
  funnel_id text,
  period_start timestamptz,
  period_end timestamptz,
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (workspace_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS public.agent_office_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.agent_office_runs(id) ON DELETE RESTRICT,
  finding_id uuid REFERENCES public.agent_office_findings(id) ON DELETE RESTRICT,
  author_agent_id uuid NOT NULL REFERENCES public.agent_office_agents(id) ON DELETE RESTRICT,
  change_area text NOT NULL CHECK (change_area IN ('frontend', 'backend', 'database', 'security', 'design')),
  status text NOT NULL DEFAULT 'patch_ready' CHECK (status IN ('patch_ready', 'tests_passed', 'awaiting_approval', 'deployed', 'rejected', 'blocked', 'rolled_back')),
  branch_name text,
  files_changed jsonb NOT NULL DEFAULT '[]'::jsonb,
  diff_summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_office_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.agent_office_proposals(id) ON DELETE RESTRICT,
  run_id uuid REFERENCES public.agent_office_runs(id) ON DELETE RESTRICT,
  command text NOT NULL,
  status text NOT NULL CHECK (status IN ('passed', 'failed', 'blocked')),
  output_redacted text NOT NULL DEFAULT '',
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_office_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.agent_office_proposals(id) ON DELETE RESTRICT,
  approver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'revision_requested')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_office_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.agent_office_proposals(id) ON DELETE RESTRICT,
  environment text NOT NULL CHECK (environment IN ('staging', 'production')),
  status text NOT NULL CHECK (status IN ('deployed', 'failed', 'rolled_back', 'blocked')),
  commit_id text,
  deployment_id text,
  rollback_of uuid REFERENCES public.agent_office_deployments(id) ON DELETE RESTRICT,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_office_runs_workspace_started_idx ON public.agent_office_runs(workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS agent_office_tasks_workspace_status_idx ON public.agent_office_tasks(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_office_findings_workspace_status_idx ON public.agent_office_findings(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_office_proposals_workspace_status_idx ON public.agent_office_proposals(workspace_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.agent_office_owner(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_master(_user_id) OR public.is_workspace_owner(_workspace_id, _user_id)
$$;

CREATE OR REPLACE FUNCTION public.agent_office_decide_proposal(_proposal_id uuid, _decision text, _comment text DEFAULT NULL)
RETURNS public.agent_office_proposals
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_proposal public.agent_office_proposals;
BEGIN
  IF _decision NOT IN ('approved', 'rejected', 'revision_requested') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;
  SELECT * INTO v_proposal FROM public.agent_office_proposals WHERE id = _proposal_id FOR UPDATE;
  IF v_proposal.id IS NULL OR NOT public.agent_office_owner(v_proposal.workspace_id) THEN RAISE EXCEPTION 'OWNER_APPROVAL_REQUIRED'; END IF;
  INSERT INTO public.agent_office_approvals(workspace_id, proposal_id, approver_id, decision, comment)
  VALUES (v_proposal.workspace_id, _proposal_id, auth.uid(), _decision, NULLIF(left(_comment, 2000), ''));
  UPDATE public.agent_office_proposals
    SET status = CASE WHEN _decision = 'approved' THEN 'tests_passed' WHEN _decision = 'rejected' THEN 'rejected' ELSE 'patch_ready' END,
        updated_at = now()
    WHERE id = _proposal_id
    RETURNING * INTO v_proposal;
  RETURN v_proposal;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_office_decide_proposal(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agent_office_decide_proposal(uuid, text, text) TO authenticated;

ALTER TABLE public.agent_office_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_office_deployments ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['agent_office_agents','agent_office_runs','agent_office_tasks','agent_office_findings','agent_office_proposals','agent_office_test_runs','agent_office_approvals','agent_office_deployments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Agent office owner read %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Agent office owner read %s" ON public.%I FOR SELECT TO authenticated USING (public.agent_office_owner(workspace_id))', t, t);
  END LOOP;
END $$;

-- No authenticated client may insert, update or delete operational history.
REVOKE ALL ON public.agent_office_agents, public.agent_office_runs, public.agent_office_tasks,
  public.agent_office_findings, public.agent_office_proposals, public.agent_office_test_runs,
  public.agent_office_approvals, public.agent_office_deployments FROM authenticated;
GRANT SELECT ON public.agent_office_agents, public.agent_office_runs, public.agent_office_tasks,
  public.agent_office_findings, public.agent_office_proposals, public.agent_office_test_runs,
  public.agent_office_approvals, public.agent_office_deployments TO authenticated;
GRANT ALL ON public.agent_office_agents, public.agent_office_runs, public.agent_office_tasks,
  public.agent_office_findings, public.agent_office_proposals, public.agent_office_test_runs,
  public.agent_office_approvals, public.agent_office_deployments TO service_role;

-- Idempotent five-agent seed for every existing workspace. Future workspaces are
-- seeded by the orchestrator on their first cycle.
INSERT INTO public.agent_office_agents (workspace_id, owner_id, role, name, permissions, config)
SELECT w.id, w.owner_id, seed.role, seed.name, seed.permissions, seed.config
FROM public.workspaces w
CROSS JOIN (VALUES
  ('ceo', 'CEO Orquestrador', '{"audit":true,"dispatch":true,"approve":false,"deploy":false}'::jsonb, '{"timeout_seconds":120}'::jsonb),
  ('backend_security', 'Dev Backend Segurança', '{"audit":true,"patch_backend":true,"migration_destructive":false,"deploy":false}'::jsonb, '{"scope":"supabase,rls,edge-functions"}'::jsonb),
  ('backend_meta_rd', 'Dev Backend Meta/RD', '{"audit":true,"patch_backend":true,"deploy":false}'::jsonb, '{"scope":"meta,rd,webhooks,cron"}'::jsonb),
  ('frontend', 'Dev Frontend', '{"audit":true,"patch_frontend":true,"deploy":false}'::jsonb, '{"approval_required":true}'::jsonb),
  ('designer', 'Designer', '{"audit":true,"patch_frontend":true,"deploy":false}'::jsonb, '{"proposal_only":true}'::jsonb)
) AS seed(role, name, permissions, config)
ON CONFLICT (workspace_id, role) DO UPDATE SET owner_id = EXCLUDED.owner_id, name = EXCLUDED.name, permissions = EXCLUDED.permissions, config = EXCLUDED.config, updated_at = now();

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$ DECLARE job_id bigint; BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'growdash-agent-office-15m';
  IF job_id IS NOT NULL THEN PERFORM cron.unschedule(job_id); END IF;
END $$;
SELECT cron.schedule('growdash-agent-office-15m', '*/15 * * * *', $cron$
  SELECT net.http_post(
    url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/agent-office-orchestrator',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)),
    body := jsonb_build_object('trigger', 'cron', 'requested_at', now()), timeout_milliseconds := 120000
  );
$cron$);
