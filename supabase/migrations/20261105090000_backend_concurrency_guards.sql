-- Prevent concurrent cron invocations from claiming the same global work.
-- Existing duplicate running rows are closed deterministically before adding
-- the partial unique indexes; no provider data is deleted.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY status ORDER BY started_at DESC, id DESC) AS rank
  FROM public.daily_incremental_sync_runs
  WHERE status = 'running'
)
UPDATE public.daily_incremental_sync_runs AS run
SET status = 'failed', finished_at = now(), error_message = 'Execução concorrente encerrada pela guarda de concorrência.'
FROM ranked
WHERE run.id = ranked.id AND ranked.rank > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY job_name ORDER BY started_at DESC, id DESC) AS rank
  FROM public.job_runs
  WHERE status = 'running'
)
UPDATE public.job_runs AS run
SET status = 'error', finished_at = now(), error_message = 'Execução concorrente encerrada pela guarda de concorrência.'
FROM ranked
WHERE run.id = ranked.id AND ranked.rank > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY started_at DESC, id DESC) AS rank
  FROM public.sync_backfill_runs
  WHERE status = 'running'
)
UPDATE public.sync_backfill_runs AS run
SET status = 'failed', finished_at = now(), error_message = 'Execução concorrente encerrada pela guarda de concorrência.'
FROM ranked
WHERE run.id = ranked.id AND ranked.rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS daily_incremental_sync_runs_one_running_idx
  ON public.daily_incremental_sync_runs (status) WHERE status = 'running';
CREATE UNIQUE INDEX IF NOT EXISTS job_runs_one_running_per_job_idx
  ON public.job_runs (job_name) WHERE status = 'running';
CREATE UNIQUE INDEX IF NOT EXISTS sync_backfill_runs_one_running_per_user_idx
  ON public.sync_backfill_runs (user_id) WHERE status = 'running';
