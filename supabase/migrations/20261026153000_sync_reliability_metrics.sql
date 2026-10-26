-- RLS-preserving 30-day SLO view for the authenticated data-health panel.
CREATE OR REPLACE VIEW public.sync_reliability_metrics
WITH (security_invoker = true)
AS
SELECT
  now() - interval '30 days' AS window_start,
  count(*)::integer AS executions_started,
  count(*) FILTER (WHERE status IN ('failed', 'blocked'))::integer AS terminal_failures,
  count(*) FILTER (WHERE status = 'success')::integer AS success_count,
  count(*) FILTER (WHERE status = 'partial')::integer AS partial_count,
  count(*) FILTER (WHERE status = 'stale')::integer AS stale_count,
  count(*) FILTER (WHERE status = 'running')::integer AS running_count,
  count(*) FILTER (WHERE status IN ('failed', 'blocked'))::numeric
    / NULLIF(count(*) FILTER (WHERE status <> 'running'), 0) * 100 AS failure_rate_pct,
  extract(epoch FROM (now() - max(coalesce(last_valid_snapshot_at, finished_at, started_at))))::integer AS snapshot_age_seconds,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY extract(epoch FROM (finished_at - started_at)) * 1000)
    FILTER (WHERE finished_at IS NOT NULL)::numeric AS duration_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM (finished_at - started_at)) * 1000)
    FILTER (WHERE finished_at IS NOT NULL)::numeric AS duration_p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY extract(epoch FROM (finished_at - started_at)) * 1000)
    FILTER (WHERE finished_at IS NOT NULL)::numeric AS duration_p99_ms,
  coalesce(sum(retry_count), 0)::integer AS retries
FROM public.sync_execution_runs
WHERE started_at >= now() - interval '30 days';

COMMENT ON VIEW public.sync_reliability_metrics IS
  'Authenticated 30-day Meta/RD synchronization SLO. Failed and blocked executions remain in the denominator.';

GRANT SELECT ON public.sync_reliability_metrics TO authenticated;
REVOKE ALL ON public.sync_reliability_metrics FROM anon, PUBLIC;
