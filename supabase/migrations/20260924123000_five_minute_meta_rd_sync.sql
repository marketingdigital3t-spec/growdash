-- Keep one idempotent server-side sync job for every authorized Meta account
-- and RD connection/funnel. The function itself enumerates all active records;
-- this migration only changes the cadence and removes the previous 15-minute
-- schedule so two schedulers cannot process the same watermark concurrently.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('growdash-quarter-hour-sync', 'growdash-five-minute-sync', 'growdash-daily-previous-day-sync')
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'growdash-five-minute-sync',
  '*/5 * * * *',
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
