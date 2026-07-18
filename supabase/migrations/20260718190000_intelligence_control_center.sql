-- Growdash Intelligence Control Center.
-- Additive migration: shared account context, OAuth health, reports and agents.

ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS attribution_window text NOT NULL DEFAULT 'account_default',
  ADD COLUMN IF NOT EXISTS oauth_health_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS oauth_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS oauth_permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS permission_health text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS last_permission_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_health_error text;

CREATE TABLE IF NOT EXISTS public.oauth_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy','expiring','expired','permission_removed','error','unchecked')),
  missing_permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  account_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  attribution_window text NOT NULL DEFAULT 'account_default',
  source_freshness jsonb NOT NULL DEFAULT '{}'::jsonb,
  unified_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  anomalies jsonb NOT NULL DEFAULT '[]'::jsonb,
  forecast jsonb NOT NULL DEFAULT '{}'::jsonb,
  executive_summary text,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, snapshot_date, attribution_window)
);

CREATE TABLE IF NOT EXISTS public.intelligence_agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  specialty text NOT NULL CHECK (specialty IN ('executive','traffic','funnel','creative','finance','crm')),
  objective text,
  funnel_stage text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Resumo executivo diário',
  phone_e164 text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  local_time time NOT NULL DEFAULT '08:00',
  weekdays smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  enabled boolean NOT NULL DEFAULT true,
  include_metrics text[] NOT NULL DEFAULT ARRAY['spend','leads','cpl','ctr','cpm','roas','frequency'],
  alert_only boolean NOT NULL DEFAULT false,
  last_sent_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_health_workspace_checked ON public.oauth_health_events(workspace_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_snapshots_lookup ON public.intelligence_snapshots(workspace_id, ad_account_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_agents_account ON public.intelligence_agent_configs(workspace_id, ad_account_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_report_due ON public.whatsapp_report_schedules(enabled, next_run_at) WHERE enabled = true;

ALTER TABLE public.oauth_health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view OAuth health" ON public.oauth_health_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view intelligence snapshots" ON public.intelligence_snapshots FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members manage intelligence agents" ON public.intelligence_agent_configs FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Members manage WhatsApp schedules" ON public.whatsapp_report_schedules FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

GRANT SELECT ON public.oauth_health_events, public.intelligence_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intelligence_agent_configs, public.whatsapp_report_schedules TO authenticated;
GRANT ALL ON public.oauth_health_events, public.intelligence_snapshots, public.intelligence_agent_configs, public.whatsapp_report_schedules TO service_role;

-- ad_accounts uses column-level grants so new safe metadata must be granted explicitly.
GRANT SELECT (attribution_window, oauth_health_status, oauth_checked_at, oauth_permissions) ON public.ad_accounts TO authenticated;
GRANT SELECT (id, provider, is_active, provider_account_id, token_expires_at, permission_health, last_permission_check_at, last_health_error, created_at, updated_at) ON public.integrations TO authenticated;

COMMENT ON COLUMN public.ad_accounts.attribution_window IS 'Attribution window used by Meta sync, e.g. 7d_click_1d_view or account_default.';
COMMENT ON TABLE public.intelligence_snapshots IS 'Immutable daily unified Meta/RD/sales/finance intelligence snapshots.';
