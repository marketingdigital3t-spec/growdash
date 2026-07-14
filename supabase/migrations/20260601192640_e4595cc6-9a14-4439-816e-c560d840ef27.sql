ALTER TABLE public.sync_runs
  ADD COLUMN IF NOT EXISTS processed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_expected integer;