-- Browser and route performance telemetry. This table contains timings only;
-- it never stores query payloads, access tokens or provider responses.
CREATE TABLE IF NOT EXISTS public.platform_performance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route text NOT NULL CHECK (char_length(route) BETWEEN 1 AND 200),
  metric_name text NOT NULL CHECK (metric_name IN ('navigation', 'route_commit', 'api_batch')),
  duration_ms numeric(12,2) NOT NULL CHECK (duration_ms >= 0 AND duration_ms < 86_400_000),
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'error')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_performance_events_workspace_created_idx
  ON public.platform_performance_events (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_performance_events_route_metric_idx
  ON public.platform_performance_events (route, metric_name, created_at DESC);

ALTER TABLE public.platform_performance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_performance_events FROM anon;
GRANT SELECT, INSERT ON TABLE public.platform_performance_events TO authenticated;
GRANT ALL ON TABLE public.platform_performance_events TO service_role;

CREATE POLICY "Workspace members read performance telemetry"
  ON public.platform_performance_events FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = user_id
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
    OR public.is_master((select auth.uid()))
  );

CREATE POLICY "Users write own performance telemetry"
  ON public.platform_performance_events FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id))
  );

COMMENT ON TABLE public.platform_performance_events IS
  'Timings de navegação e renderização da plataforma; sem payloads, tokens ou respostas de provedores.';
