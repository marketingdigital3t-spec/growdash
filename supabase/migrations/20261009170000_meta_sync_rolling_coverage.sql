-- Additive traceability for the selected period plus rolling attribution window.
ALTER TABLE public.meta_sync_runs
  ADD COLUMN IF NOT EXISTS days_covered date[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.meta_sync_runs.days_covered IS
  'Inclusive civil dates queried for this Meta sync, including the rolling attribution-settlement window.';
