
CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  funnel_id uuid,
  provider text NOT NULL DEFAULT 'rd_station_crm',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running',
  deals_fetched integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  details_fetched integer NOT NULL DEFAULT 0,
  contacts_fetched integer NOT NULL DEFAULT 0,
  retries_total integer NOT NULL DEFAULT 0,
  errors_total integer NOT NULL DEFAULT 0,
  error_message text,
  trigger_source text DEFAULT 'manual'
);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sync runs" ON public.sync_runs
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own sync runs" ON public.sync_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sync runs" ON public.sync_runs
  FOR UPDATE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_sync_runs_user_started ON public.sync_runs(user_id, started_at DESC);
