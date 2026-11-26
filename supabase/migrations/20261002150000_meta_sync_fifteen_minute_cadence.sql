-- The browser refreshes immediately on entry/filter/focus events. The
-- server-wide reconciliation is intentionally less frequent and protected by
-- per-scope locks so it cannot multiply Graph API calls across tabs.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('growdash-five-minute-sync', 'growdash-quarter-hour-sync', 'growdash-fifteen-minute-sync')
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
