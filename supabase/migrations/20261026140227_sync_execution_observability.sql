-- Unified audit trail for Meta/RD synchronization attempts.
-- The execution id is the sync_run_id returned by Edge Functions and is safe
-- to expose to the authenticated workspace owner; provider payloads and tokens
-- are intentionally not stored here.
CREATE TABLE IF NOT EXISTS public.sync_execution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('controlled', 'meta', 'meta_leads', 'rd', 'balance', 'daily')),
  trigger_source text NOT NULL DEFAULT 'manual',
  scope_key text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_version text NOT NULL DEFAULT 'sync-v1',
  code_version text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'stale', 'failed', 'blocked')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  last_valid_snapshot_at timestamptz,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  records_read integer NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  records_upserted integer NOT NULL DEFAULT 0 CHECK (records_upserted >= 0),
  error_code text,
  error_message text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_execution_runs_user_started_idx
  ON public.sync_execution_runs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_execution_runs_scope_started_idx
  ON public.sync_execution_runs (scope_key, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_execution_runs_status_started_idx
  ON public.sync_execution_runs (status, started_at DESC);

ALTER TABLE public.sync_execution_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sync_execution_runs FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.sync_execution_runs TO authenticated;
GRANT ALL ON TABLE public.sync_execution_runs TO service_role;

DROP POLICY IF EXISTS "Users can view own sync execution runs" ON public.sync_execution_runs;
CREATE POLICY "Users can view own sync execution runs"
  ON public.sync_execution_runs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'master'::app_role)
  );

COMMENT ON TABLE public.sync_execution_runs IS
  'One row per Meta/RD synchronization attempt. Never stores provider tokens or raw payloads.';
COMMENT ON COLUMN public.sync_execution_runs.id IS
  'Public correlation id returned as sync_run_id; use it to join UI, logs and Sentry events.';
COMMENT ON COLUMN public.sync_execution_runs.status IS
  'Terminal contract: success, partial, stale, failed or blocked. running is transient.';
