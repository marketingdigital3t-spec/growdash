ALTER TABLE public.daily_incremental_sync_runs
  ADD COLUMN IF NOT EXISTS meta_hourly jsonb;

COMMENT ON COLUMN public.daily_incremental_sync_runs.meta_hourly IS
  'Resultado da sincronização horária da Meta dentro da janela incremental.';
