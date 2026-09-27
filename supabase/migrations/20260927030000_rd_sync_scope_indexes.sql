-- Keep the all-funnel reconciliation queries index-backed. The service-role
-- sync intentionally scopes by the local funnel UUID and does not rely on RLS
-- to provide the filter.
CREATE INDEX IF NOT EXISTS rd_deals_funnel_created_id_idx
  ON public.rd_deals (rd_funnel_id, lead_created_at, rd_deal_id);

CREATE INDEX IF NOT EXISTS sync_runs_funnel_status_started_idx
  ON public.sync_runs (funnel_id, status, started_at DESC);
