-- Additive follow-up for the already-applied Agent Office governance schema.
-- Tasks are idempotent per finding within a run.
ALTER TABLE public.agent_office_tasks
  ADD COLUMN IF NOT EXISTS finding_id uuid REFERENCES public.agent_office_findings(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS agent_office_tasks_run_finding_uidx
  ON public.agent_office_tasks (workspace_id, run_id, finding_id)
  WHERE finding_id IS NOT NULL;
