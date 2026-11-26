-- The daily incremental sync can legitimately take a few minutes when several
-- Meta accounts and RD funnels are connected. pg_net defaults to a 5-second
-- response timeout, which records a false timeout even though the Edge Function
-- continues and completes successfully. Recreate the job with a 5-minute wait.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'growdash-daily-previous-day-sync'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'growdash-daily-previous-day-sync',
  '0 6 * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/daily-incremental-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT cron_secret
          FROM private.daily_incremental_sync_config
          WHERE singleton = true
        )
      ),
      body := jsonb_build_object(
        'trigger', 'pg_cron',
        'requested_at', now()
      ),
      timeout_milliseconds := 300000
    );
  $cron$
);
