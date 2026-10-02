-- Observability for the selected Meta scope. The daily Insights snapshot and
-- auxiliary blocks have independent coverage and errors.
ALTER TABLE public.meta_sync_scope_state
  ADD COLUMN IF NOT EXISTS covered_start_date date,
  ADD COLUMN IF NOT EXISTS covered_end_date date,
  ADD COLUMN IF NOT EXISTS pages_processed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_cursor text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS block_status jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.meta_sync_scope_state.block_status IS
  'Status por bloco: insights, actions, hourly e breakdowns; nunca usar ausencia como zero.';
