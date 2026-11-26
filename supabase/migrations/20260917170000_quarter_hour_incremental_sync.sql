-- Server-side incremental sync every 15 minutes. Historical rows remain
-- untouched; each run records the exact window it processed.
ALTER TABLE public.daily_incremental_sync_runs
  ADD COLUMN IF NOT EXISTS window_start timestamptz,
  ADD COLUMN IF NOT EXISTS window_end timestamptz,
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'incremental';

CREATE INDEX IF NOT EXISTS daily_incremental_sync_runs_window_idx
  ON public.daily_incremental_sync_runs (window_end DESC, started_at DESC);

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id FROM cron.job
  WHERE jobname IN ('growdash-daily-previous-day-sync', 'growdash-quarter-hour-sync')
  ORDER BY CASE WHEN jobname = 'growdash-quarter-hour-sync' THEN 0 ELSE 1 END
  LIMIT 1;
  IF existing_job_id IS NOT NULL THEN PERFORM cron.unschedule(existing_job_id); END IF;
END $$;

SELECT cron.schedule(
  'growdash-quarter-hour-sync',
  '*/15 * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/daily-incremental-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)
      ),
      body := jsonb_build_object('trigger', 'pg_cron', 'requested_at', now()),
      timeout_milliseconds := 300000
    );
  $cron$
);
