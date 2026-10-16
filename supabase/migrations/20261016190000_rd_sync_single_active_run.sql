-- A funnel may have at most one active RD sync. The application still closes
-- orphaned rows, but the partial unique index makes the check atomic when a
-- manual refresh and the realtime cycle start at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_one_running_per_funnel_idx
  ON public.sync_runs (funnel_id)
  WHERE status = 'running';
