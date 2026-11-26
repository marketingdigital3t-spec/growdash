-- Per-account Meta watermark and coverage state.  A global cursor lets one
-- slow/failed account advance or delay every other account; this table keeps
-- the cursor bound to the exact requested scope instead.
CREATE TABLE IF NOT EXISTS public.meta_sync_scope_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  campaign_scope text NOT NULL DEFAULT 'all-campaigns',
  start_date date NOT NULL,
  end_date date NOT NULL,
  timezone text NOT NULL,
  attribution_window text NOT NULL DEFAULT 'account_default',
  status text NOT NULL DEFAULT 'idle',
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_valid_snapshot_at timestamptz,
  last_error text,
  covered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, campaign_scope, start_date, end_date, timezone, attribution_window)
);

CREATE INDEX IF NOT EXISTS idx_meta_sync_scope_state_account
  ON public.meta_sync_scope_state (ad_account_id, last_started_at DESC);

ALTER TABLE public.meta_sync_scope_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own Meta sync scope state"
  ON public.meta_sync_scope_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_accounts a
      WHERE a.id = meta_sync_scope_state.ad_account_id
        AND (a.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role))
    )
  );
REVOKE ALL ON public.meta_sync_scope_state FROM PUBLIC;
GRANT SELECT ON public.meta_sync_scope_state TO authenticated;
GRANT ALL ON public.meta_sync_scope_state TO service_role;
