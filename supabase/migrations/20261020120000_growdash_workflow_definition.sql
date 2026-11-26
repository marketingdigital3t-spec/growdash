ALTER TABLE public.growdash_automations
  ADD COLUMN IF NOT EXISTS workflow_definition jsonb,
  ADD COLUMN IF NOT EXISTS workflow_version integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS growdash_automations_workspace_updated_idx
  ON public.growdash_automations(workspace_id, updated_at DESC);
