-- Keep the server-side Meta/RD reconciliation at the same quarter-hour cadence
-- as the browser. Realtime continues to deliver already-persisted changes
-- between cycles; it must not start a provider request on every UI update.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'growdash-five-minute-sync',
      'growdash-quarter-hour-sync',
      'growdash-fifteen-minute-sync'
    )
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'growdash-fifteen-minute-sync',
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
