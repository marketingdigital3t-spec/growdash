-- Business: official Meta audience snapshots and idempotent webhook intake.
-- Tokens remain in protected integrations/ad_accounts; these tables contain
-- only scoped, audit-friendly provider data.
CREATE TABLE IF NOT EXISTS public.meta_audience_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  insight_date date NOT NULL,
  breakdown_type text NOT NULL,
  segment_key text NOT NULL,
  value numeric NOT NULL,
  source text NOT NULL DEFAULT 'meta_graph_api',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','partial','failed','blocked','stale')),
  UNIQUE (ad_account_id, social_account_id, insight_date, breakdown_type, segment_key)
);

CREATE INDEX IF NOT EXISTS meta_audience_scope_idx
  ON public.meta_audience_insights_daily (workspace_id, ad_account_id, social_account_id, insight_date DESC);

CREATE TABLE IF NOT EXISTS public.meta_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_sha256 text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  error_message text,
  UNIQUE (provider_event_id, event_type)
);

CREATE INDEX IF NOT EXISTS meta_webhook_events_received_idx
  ON public.meta_webhook_events (workspace_id, received_at DESC);

ALTER TABLE public.meta_audience_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_webhook_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.meta_audience_insights_daily TO authenticated;
GRANT ALL ON public.meta_audience_insights_daily, public.meta_webhook_events TO service_role;

DROP POLICY IF EXISTS "Members view Meta audience snapshots" ON public.meta_audience_insights_daily;
CREATE POLICY "Members view Meta audience snapshots"
  ON public.meta_audience_insights_daily FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id));

COMMENT ON TABLE public.meta_audience_insights_daily IS 'Official Meta audience/demographic snapshots. Missing metrics stay unavailable.';
COMMENT ON TABLE public.meta_webhook_events IS 'Idempotent Meta webhook audit log; raw payload is service-role only.';
