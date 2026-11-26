-- Keep transient workflow execution failures recoverable and observable.
ALTER TABLE public.growdash_workflow_schedules
  ADD COLUMN IF NOT EXISTS failure_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.growdash_workflow_schedules
  DROP CONSTRAINT IF EXISTS growdash_workflow_schedules_failure_count_check;

ALTER TABLE public.growdash_workflow_schedules
  ADD CONSTRAINT growdash_workflow_schedules_failure_count_check
  CHECK (failure_count >= 0);
