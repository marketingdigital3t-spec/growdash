CREATE TABLE IF NOT EXISTS public.rd_metric_reconciliation_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.daily_incremental_sync_runs(id) ON DELETE SET NULL,
  funnel_id uuid REFERENCES public.rd_funnels(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  rd_won_count integer NOT NULL DEFAULT 0,
  linked_sale_count integer NOT NULL DEFAULT 0,
  missing_sale_count integer NOT NULL DEFAULT 0,
  duplicate_rd_count integer NOT NULL DEFAULT 0,
  missing_sale_rd_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_incremental_sync_runs
  ADD COLUMN IF NOT EXISTS rd_metric_reconciliation jsonb;
COMMENT ON COLUMN public.daily_incremental_sync_runs.rd_metric_reconciliation IS
  'Canonical RD won-deal versus linked-financial-sale audit for each active funnel.';

CREATE INDEX IF NOT EXISTS rd_metric_reconciliation_audits_checked_idx
  ON public.rd_metric_reconciliation_audits (checked_at DESC);
CREATE INDEX IF NOT EXISTS rd_metric_reconciliation_audits_funnel_idx
  ON public.rd_metric_reconciliation_audits (funnel_id, checked_at DESC);

ALTER TABLE public.rd_metric_reconciliation_audits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rd_metric_reconciliation_audits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rd_metric_reconciliation_audits TO service_role;
GRANT SELECT ON public.rd_metric_reconciliation_audits TO authenticated;
CREATE POLICY rd_metric_reconciliation_owner_read
  ON public.rd_metric_reconciliation_audits FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_rd_funnel_access access
      WHERE access.user_id = auth.uid() AND access.rd_funnel_id = rd_metric_reconciliation_audits.funnel_id
    )
  );
