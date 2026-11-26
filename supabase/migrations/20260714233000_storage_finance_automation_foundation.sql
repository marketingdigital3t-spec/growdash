-- Growdash unified storage, finance connections and traffic automation foundation.
-- Additive only. Apply after 20260714210000_workspace_billing_finance_foundation.sql.

UPDATE public.plan_catalog
SET entitlements = jsonb_set(
  COALESCE(entitlements, '{}'::jsonb),
  '{storage_bytes}',
  to_jsonb(CASE code
    WHEN 'starter' THEN 5368709120::bigint
    WHEN 'growth' THEN 26843545600::bigint
    WHEN 'scale' THEN 107374182400::bigint
    WHEN 'agency' THEN 536870912000::bigint
    ELSE 5368709120::bigint
  END),
  true
)
WHERE code IN ('starter', 'growth', 'scale', 'agency');

CREATE TABLE IF NOT EXISTS public.workspace_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bucket_id text,
  object_path text,
  original_name text NOT NULL,
  mime_type text,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  checksum text,
  module text NOT NULL DEFAULT 'uploads',
  entity_type text,
  entity_id text,
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','avatar','meta','finance','automation','crm','report','import','external')),
  external_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('uploading','active','quarantined','deleted','failed','external')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((bucket_id IS NOT NULL AND object_path IS NOT NULL) OR external_url IS NOT NULL),
  UNIQUE (bucket_id, object_path)
);

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  name text NOT NULL,
  legal_name text,
  tax_id text,
  expert_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  provider text,
  external_id text,
  account_type text NOT NULL CHECK (account_type IN ('bank','credit_card','wallet')),
  name text NOT NULL,
  institution_name text,
  last_four text,
  currency text NOT NULL DEFAULT 'BRL',
  balance numeric(16,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','expired','error','disconnected')),
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  financial_account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('credit','debit')),
  description text NOT NULL,
  amount numeric(16,2) NOT NULL CHECK (amount >= 0),
  occurred_at timestamptz NOT NULL,
  category text,
  matched_entry_id uuid REFERENCES public.financial_entries(id) ON DELETE SET NULL,
  match_confidence numeric(5,4),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financial_account_id, external_id)
);

CREATE TABLE IF NOT EXISTS public.saved_table_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL,
  is_shared boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, scope, name)
);

CREATE TABLE IF NOT EXISTS public.campaign_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create','update','duplicate','pause','activate')),
  entity_type text NOT NULL CHECK (entity_type IN ('campaign','adset','ad')),
  entity_external_id text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','approved','publishing','published','failed','canceled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  external_request_id text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_change_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.campaign_drafts(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_external_id text NOT NULL,
  reason text,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  rollback_of uuid REFERENCES public.campaign_change_snapshots(id) ON DELETE SET NULL,
  external_request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.traffic_playbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  objective text NOT NULL,
  template_key text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','archived')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meta_breakdown_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  entity_level text NOT NULL CHECK (entity_level IN ('account','campaign','adset','ad')),
  entity_external_id text NOT NULL,
  insight_date date NOT NULL,
  breakdown_type text NOT NULL,
  breakdown_key text NOT NULL,
  attribution_window text NOT NULL DEFAULT 'account_default',
  spend numeric(16,4) NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  leads numeric(16,4) NOT NULL DEFAULT 0,
  conversions numeric(16,4) NOT NULL DEFAULT 0,
  revenue numeric(16,4) NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, entity_level, entity_external_id, insight_date, breakdown_type, breakdown_key, attribution_window)
);

CREATE TABLE IF NOT EXISTS public.meta_video_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  ad_external_id text NOT NULL,
  insight_date date NOT NULL,
  attribution_window text NOT NULL DEFAULT 'account_default',
  video_plays bigint NOT NULL DEFAULT 0,
  video_3s bigint NOT NULL DEFAULT 0,
  video_25 bigint NOT NULL DEFAULT 0,
  video_50 bigint NOT NULL DEFAULT 0,
  video_75 bigint NOT NULL DEFAULT 0,
  video_95 bigint NOT NULL DEFAULT 0,
  video_100 bigint NOT NULL DEFAULT 0,
  thruplay bigint NOT NULL DEFAULT 0,
  cost_per_thruplay numeric(16,4),
  avg_watch_time_seconds numeric(16,4),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, ad_external_id, insight_date, attribution_window)
);

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','partial','failed')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('matched','probable','unmatched','conflict')),
  meta_lead_id text,
  rd_lead_id text,
  sale_id text,
  confidence numeric(5,4),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budget_pacing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  account_timezone text NOT NULL,
  daily_budget numeric(16,2) NOT NULL DEFAULT 0,
  spend_today numeric(16,2) NOT NULL DEFAULT 0,
  expected_spend numeric(16,2) NOT NULL DEFAULT 0,
  pacing_ratio numeric(10,4),
  projected_spend numeric(16,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (ad_account_id, captured_at)
);

CREATE TABLE IF NOT EXISTS public.budget_pacing_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved','muted')),
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (workspace_id, ad_account_id, alert_key, status)
);

CREATE INDEX IF NOT EXISTS idx_workspace_files_workspace_status ON public.workspace_files(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_files_source ON public.workspace_files(workspace_id, source, module);
CREATE INDEX IF NOT EXISTS idx_companies_workspace ON public.companies(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON public.financial_transactions(workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_drafts_workspace ON public.campaign_drafts(workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_snapshots_entity ON public.campaign_change_snapshots(workspace_id, entity_external_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_breakdown_lookup ON public.meta_breakdown_insights(ad_account_id, insight_date, breakdown_type);
CREATE INDEX IF NOT EXISTS idx_video_lookup ON public.meta_video_insights(ad_account_id, insight_date, ad_external_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_items_run ON public.reconciliation_items(run_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_pacing_lookup ON public.budget_pacing_snapshots(ad_account_id, captured_at DESC);

ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_table_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_change_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_breakdown_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_video_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_pacing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_pacing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workspace files" ON public.workspace_files FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members upload workspace files" ON public.workspace_files FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND owner_id = auth.uid());
CREATE POLICY "Members update own files" ON public.workspace_files FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.can_manage_workspace(workspace_id)) WITH CHECK (owner_id = auth.uid() OR public.can_manage_workspace(workspace_id));
CREATE POLICY "Admins remove workspace files" ON public.workspace_files FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.can_manage_workspace(workspace_id));

CREATE POLICY "Members view companies" ON public.companies FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members view financial accounts" ON public.financial_accounts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Finance admins manage accounts" ON public.financial_accounts FOR ALL TO authenticated USING (public.can_manage_finance(workspace_id)) WITH CHECK (public.can_manage_finance(workspace_id));
CREATE POLICY "Members view financial transactions" ON public.financial_transactions FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Service manages financial transactions" ON public.financial_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Members manage own views" ON public.saved_table_views FOR ALL TO authenticated USING (user_id = auth.uid() AND public.is_workspace_member(workspace_id)) WITH CHECK (user_id = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE POLICY "Members view shared views" ON public.saved_table_views FOR SELECT TO authenticated USING (is_shared AND public.is_workspace_member(workspace_id));
CREATE POLICY "Members view campaign drafts" ON public.campaign_drafts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members create own drafts" ON public.campaign_drafts FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.is_workspace_member(workspace_id));
CREATE POLICY "Admins review campaign drafts" ON public.campaign_drafts FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.can_manage_workspace(workspace_id)) WITH CHECK (created_by = auth.uid() OR public.can_manage_workspace(workspace_id));
CREATE POLICY "Members view campaign history" ON public.campaign_change_snapshots FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members manage playbooks" ON public.traffic_playbooks FOR ALL TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view breakdown insights" ON public.meta_breakdown_insights FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view video insights" ON public.meta_video_insights FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view reconciliations" ON public.reconciliation_runs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Finance starts reconciliation" ON public.reconciliation_runs FOR INSERT TO authenticated WITH CHECK (public.can_manage_finance(workspace_id) AND started_by = auth.uid());
CREATE POLICY "Members view reconciliation items" ON public.reconciliation_items FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view pacing" ON public.budget_pacing_snapshots FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view pacing alerts" ON public.budget_pacing_alerts FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins update pacing alerts" ON public.budget_pacing_alerts FOR UPDATE TO authenticated USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_files, public.companies, public.financial_accounts,
  public.saved_table_views, public.campaign_drafts, public.traffic_playbooks TO authenticated;
GRANT SELECT ON public.financial_transactions, public.campaign_change_snapshots, public.meta_breakdown_insights,
  public.meta_video_insights, public.reconciliation_items, public.budget_pacing_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.reconciliation_runs TO authenticated;
GRANT SELECT, UPDATE ON public.budget_pacing_alerts TO authenticated;
GRANT ALL ON public.workspace_files, public.companies, public.financial_accounts, public.financial_transactions,
  public.saved_table_views, public.campaign_drafts, public.campaign_change_snapshots, public.traffic_playbooks,
  public.meta_breakdown_insights, public.meta_video_insights, public.reconciliation_runs, public.reconciliation_items,
  public.budget_pacing_snapshots, public.budget_pacing_alerts TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-files',
  'workspace-files',
  false,
  104857600,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.can_access_workspace_object(_name text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.is_workspace_member(split_part(_name, '/', 1)::uuid, _user_id);
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_workspace_object(text, uuid) TO authenticated;

CREATE POLICY "Members read workspace objects" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workspace-files' AND public.can_access_workspace_object(name));
CREATE POLICY "Members upload workspace objects" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workspace-files' AND public.can_access_workspace_object(name));
CREATE POLICY "Members update workspace objects" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'workspace-files' AND public.can_access_workspace_object(name))
  WITH CHECK (bucket_id = 'workspace-files' AND public.can_access_workspace_object(name));
CREATE POLICY "Members delete workspace objects" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workspace-files' AND public.can_access_workspace_object(name));
