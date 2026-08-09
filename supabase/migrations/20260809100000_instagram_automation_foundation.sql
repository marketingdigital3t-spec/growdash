-- Functional automation foundation for Instagram and Growdash operational triggers.
-- Actions are declarative JSON so new Meta capabilities can be added without
-- rewriting existing automations. No existing data is removed.

CREATE TABLE IF NOT EXISTS public.growdash_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'instagram_comment', 'instagram_message', 'new_lead', 'campaign_underperforming', 'manual'
  )),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'error')),
  run_count integer NOT NULL DEFAULT 0 CHECK (run_count >= 0),
  last_run_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.growdash_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.growdash_automations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  trigger_event jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS growdash_automations_workspace_status_idx
  ON public.growdash_automations(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS growdash_automation_runs_automation_idx
  ON public.growdash_automation_runs(automation_id, created_at DESC);

ALTER TABLE public.growdash_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growdash_automation_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growdash_automations TO authenticated;
GRANT SELECT ON public.growdash_automation_runs TO authenticated;
GRANT ALL ON public.growdash_automations, public.growdash_automation_runs TO service_role;

DROP POLICY IF EXISTS "Workspace members manage Growdash automations" ON public.growdash_automations;
DROP POLICY IF EXISTS "Workspace members view Growdash automations" ON public.growdash_automations;
DROP POLICY IF EXISTS "Workspace editors create Growdash automations" ON public.growdash_automations;
DROP POLICY IF EXISTS "Workspace editors update Growdash automations" ON public.growdash_automations;
DROP POLICY IF EXISTS "Workspace editors delete Growdash automations" ON public.growdash_automations;
CREATE POLICY "Workspace members view Growdash automations"
  ON public.growdash_automations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace editors create Growdash automations"
  ON public.growdash_automations FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_workspace(workspace_id) AND created_by = auth.uid());
CREATE POLICY "Workspace editors update Growdash automations"
  ON public.growdash_automations FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "Workspace editors delete Growdash automations"
  ON public.growdash_automations FOR DELETE TO authenticated
  USING (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace members view Growdash automation runs" ON public.growdash_automation_runs;
CREATE POLICY "Workspace members view Growdash automation runs"
  ON public.growdash_automation_runs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.set_growdash_automation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS growdash_automations_updated_at ON public.growdash_automations;
CREATE TRIGGER growdash_automations_updated_at
  BEFORE UPDATE ON public.growdash_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_growdash_automation_updated_at();

COMMENT ON TABLE public.growdash_automations IS
  'Workspace-scoped, auditable automations. Instagram actions require Meta permissions and webhook configuration.';
