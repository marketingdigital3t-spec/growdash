-- Daily incremental synchronization for the previous São Paulo calendar day.
-- Historical rows are never truncated: each provider performs idempotent upserts
-- restricted to target_date.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.daily_incremental_sync_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  cron_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.daily_incremental_sync_config (singleton, cron_secret)
VALUES (true, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (singleton) DO NOTHING;

REVOKE ALL ON TABLE private.daily_incremental_sync_config
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.daily_incremental_sync_config TO service_role;

CREATE OR REPLACE FUNCTION public.verify_daily_incremental_sync_secret(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT candidate IS NOT NULL
    AND candidate = (
      SELECT cron_secret
      FROM private.daily_incremental_sync_config
      WHERE singleton = true
    );
$$;

REVOKE ALL ON FUNCTION public.verify_daily_incremental_sync_secret(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_daily_incremental_sync_secret(text)
TO service_role;

CREATE TABLE IF NOT EXISTS public.daily_incremental_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL,
  trigger_source text NOT NULL DEFAULT 'pg_cron',
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'partial', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  meta_insights jsonb,
  meta_leads jsonb,
  rd jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_incremental_sync_runs_target_date_idx
ON public.daily_incremental_sync_runs (target_date DESC, started_at DESC);

ALTER TABLE public.daily_incremental_sync_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.daily_incremental_sync_runs
FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.daily_incremental_sync_runs TO service_role;

COMMENT ON TABLE public.daily_incremental_sync_runs IS
  'Auditoria do job diário que sincroniza somente o dia anterior para Meta Ads e RD Station.';

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

-- pg_cron runs in UTC. 06:00 UTC is 03:00 in America/Sao_Paulo.
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
      )
    );
  $cron$
);
