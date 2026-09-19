-- Auditable, idempotent historical reconciliation for Meta Ads + RD Station.
-- The provider API is the only upper bound; no application page/deal ceiling is
-- applied to a historical run. Each provider window is recorded independently.

CREATE TABLE IF NOT EXISTS public.sync_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  mode text NOT NULL DEFAULT 'historical' CHECK (mode = 'historical'),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_backfill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.sync_backfill_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta_insights', 'meta_leads', 'meta_hourly', 'rd_deals')),
  account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  funnel_id uuid REFERENCES public.rd_funnels(id) ON DELETE SET NULL,
  window_start date,
  window_end date,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  pages_read integer NOT NULL DEFAULT 0,
  records_read integer NOT NULL DEFAULT 0,
  records_upserted integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  last_cursor text,
  gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_backfill_runs_user_started_idx
  ON public.sync_backfill_runs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS sync_backfill_items_run_provider_idx
  ON public.sync_backfill_items (run_id, provider, started_at);
CREATE INDEX IF NOT EXISTS sync_backfill_items_user_status_idx
  ON public.sync_backfill_items (user_id, status, started_at DESC);

ALTER TABLE public.sync_backfill_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_backfill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_backfill_runs_owner_read ON public.sync_backfill_runs;
CREATE POLICY sync_backfill_runs_owner_read ON public.sync_backfill_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS sync_backfill_items_owner_read ON public.sync_backfill_items;
CREATE POLICY sync_backfill_items_owner_read ON public.sync_backfill_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());

GRANT SELECT ON public.sync_backfill_runs, public.sync_backfill_items TO authenticated;
GRANT ALL ON public.sync_backfill_runs, public.sync_backfill_items TO service_role;
