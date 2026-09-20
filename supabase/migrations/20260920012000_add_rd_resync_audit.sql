ALTER TABLE public.daily_incremental_sync_runs
  ADD COLUMN IF NOT EXISTS rd_resync jsonb;

COMMENT ON COLUMN public.daily_incremental_sync_runs.rd_resync IS
  'Resultado opcional da reconciliação pesada de negócios RD.';
