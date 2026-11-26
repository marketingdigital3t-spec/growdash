
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  email_alerts_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

CREATE TABLE public.ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  daily_budget numeric DEFAULT NULL,
  remaining_balance numeric DEFAULT NULL,
  target_cpl numeric,
  min_spend_threshold numeric NOT NULL DEFAULT 50,
  connection_status text NOT NULL DEFAULT 'unknown',
  last_sync_error text,
  last_sync_error_code integer,
  last_sync_attempt_at timestamptz,
  last_sync_success_at timestamptz
);

CREATE TABLE public.campaigns (
  id TEXT PRIMARY KEY,
  ad_account_id UUID REFERENCES public.ad_accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  objective TEXT,
  status text,
  last_activated_at timestamptz,
  previous_status text
);

CREATE TABLE public.adsets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  daily_budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status text,
  last_activated_at timestamptz,
  previous_status text,
  destination_type text
);

CREATE TABLE public.ads (
  id TEXT PRIMARY KEY,
  adset_id TEXT REFERENCES public.adsets(id) ON DELETE CASCADE NOT NULL,
  creative_id TEXT,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status text,
  last_activated_at timestamptz,
  previous_status text
);

CREATE TABLE public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id TEXT REFERENCES public.ads(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  frequency NUMERIC DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  efficiency_rate NUMERIC DEFAULT 0,
  health_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT insights_ad_id_date_unique UNIQUE (ad_id, date)
);

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ad_id TEXT REFERENCES public.ads(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adsets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.ad_accounts, public.campaigns, public.adsets, public.ads, public.insights, public.alerts TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.user_owns_ad_account(_user_id UUID, _ad_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ad_accounts WHERE id = _ad_account_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_campaign(_user_id UUID, _campaign_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.campaigns c JOIN public.ad_accounts aa ON aa.id = c.ad_account_id WHERE c.id = _campaign_id AND aa.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_ad(_user_id UUID, _ad_id TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ads a JOIN public.adsets ast ON ast.id = a.adset_id JOIN public.campaigns c ON c.id = ast.campaign_id JOIN public.ad_accounts aa ON aa.id = c.ad_account_id WHERE a.id = _ad_id AND aa.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ad_accounts_updated_at BEFORE UPDATE ON public.ad_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_adsets_updated_at BEFORE UPDATE ON public.adsets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own ad accounts" ON public.ad_accounts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create ad accounts" ON public.ad_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ad accounts" ON public.ad_accounts FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own ad accounts" ON public.ad_accounts FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), id));
CREATE POLICY "Users can insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), id));
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), id));

CREATE POLICY "Users can view own adsets" ON public.adsets FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Users can insert adsets" ON public.adsets FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Users can update own adsets" ON public.adsets FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Users can delete own adsets" ON public.adsets FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));

CREATE POLICY "Users can view own ads" ON public.ads FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), id));
CREATE POLICY "Users can insert ads" ON public.ads FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.adsets ast JOIN public.campaigns c ON c.id = ast.campaign_id JOIN public.ad_accounts aa ON aa.id = c.ad_account_id WHERE ast.id = adset_id AND aa.user_id = auth.uid()));
CREATE POLICY "Users can update own ads" ON public.ads FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), id));
CREATE POLICY "Users can delete own ads" ON public.ads FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), id));

CREATE POLICY "Users can view own insights" ON public.insights FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id));
CREATE POLICY "Users can insert insights" ON public.insights FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id));

CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own alerts" ON public.alerts FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_insights_ad_date ON public.insights(ad_id, date);
CREATE INDEX idx_alerts_user ON public.alerts(user_id, is_read);
CREATE INDEX idx_ad_accounts_user ON public.ad_accounts(user_id);
CREATE INDEX idx_campaigns_account ON public.campaigns(ad_account_id);
CREATE INDEX idx_adsets_campaign ON public.adsets(campaign_id);
CREATE INDEX idx_ads_adset ON public.ads(adset_id);

CREATE TABLE public.funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Novo Funil',
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  connections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  campaign_ids text[] DEFAULT '{}',
  funnel_type text NOT NULL DEFAULT 'blank'
);
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funnels TO authenticated;
GRANT ALL ON public.funnels TO service_role;
CREATE POLICY "Users can view own funnels" ON public.funnels FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create funnels" ON public.funnels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own funnels" ON public.funnels FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own funnels" ON public.funnels FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_funnels_updated_at BEFORE UPDATE ON public.funnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
CREATE POLICY "Users can view own products" ON public.products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  campaign_ids text[] DEFAULT '{}',
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  gross_revenue numeric NOT NULL DEFAULT 0,
  net_revenue numeric NOT NULL DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  refund_amount numeric DEFAULT 0,
  chargeback_amount numeric DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'confirmed',
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lead_state text,
  lead_formation text,
  rd_deal_id text,
  contact_name text,
  contact_phone text,
  contact_email TEXT,
  lead_city text,
  lead_entry_date DATE,
  adset_id text,
  ad_id text,
  rd_campaign_name TEXT,
  rd_product_name TEXT,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  rd_funnel_id uuid,
  matched_campaign_id text,
  match_method text,
  manual_platform text,
  manual_campaign_id text,
  manual_adset_id text,
  manual_ad_id text,
  manual_override boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX sales_rd_deal_id_idx ON public.sales (rd_deal_id) WHERE rd_deal_id IS NOT NULL;
CREATE INDEX idx_sales_matched_campaign ON public.sales(matched_campaign_id);
CREATE INDEX idx_sales_rd_funnel ON public.sales(rd_funnel_id);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
CREATE POLICY "Users can view own sales" ON public.sales FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales" ON public.sales FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales" ON public.sales FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'rd_station_crm',
  webhook_secret text,
  is_active boolean DEFAULT true,
  api_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
CREATE POLICY "Users can view own integrations" ON public.integrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create integrations" ON public.integrations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own integrations" ON public.integrations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own integrations" ON public.integrations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaign_targets (
  campaign_id text PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  target_cpl numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_targets TO authenticated;
GRANT ALL ON public.campaign_targets TO service_role;
CREATE POLICY "View campaign targets" ON public.campaign_targets FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Insert campaign targets" ON public.campaign_targets FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Update campaign targets" ON public.campaign_targets FOR UPDATE USING (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Delete campaign targets" ON public.campaign_targets FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE TRIGGER update_campaign_targets_updated_at BEFORE UPDATE ON public.campaign_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.campaign_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL,
  field text,
  old_value text,
  new_value text,
  note text,
  created_by uuid,
  entity_type text NOT NULL DEFAULT 'campaign',
  entity_id text
);
CREATE INDEX idx_campaign_changes_campaign ON public.campaign_changes(campaign_id, changed_at DESC);
CREATE INDEX idx_campaign_changes_entity ON public.campaign_changes(entity_type, entity_id, changed_at DESC);
ALTER TABLE public.campaign_changes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_changes TO authenticated;
GRANT ALL ON public.campaign_changes TO service_role;
CREATE POLICY "View campaign changes" ON public.campaign_changes FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Insert campaign changes" ON public.campaign_changes FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Delete campaign changes" ON public.campaign_changes FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));

CREATE TABLE public.account_balance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  event_at timestamptz NOT NULL DEFAULT now(),
  delta numeric NOT NULL,
  new_balance numeric,
  source text NOT NULL DEFAULT 'meta_sync'
);
CREATE INDEX idx_balance_events_account ON public.account_balance_events(ad_account_id, event_at DESC);
ALTER TABLE public.account_balance_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_balance_events TO authenticated;
GRANT ALL ON public.account_balance_events TO service_role;
CREATE POLICY "View balance events" ON public.account_balance_events FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert balance events" ON public.account_balance_events FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TABLE public.rd_funnels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  name text NOT NULL,
  expert_name text,
  rd_funnel_id text,
  utm_campaign_pattern text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rd_funnels_account ON public.rd_funnels(ad_account_id);
CREATE INDEX idx_rd_funnels_user ON public.rd_funnels(user_id);
ALTER TABLE public.rd_funnels ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_funnels TO authenticated;
GRANT ALL ON public.rd_funnels TO service_role;
CREATE POLICY "View rd funnels" ON public.rd_funnels FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert rd funnels" ON public.rd_funnels FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR (auth.uid() = user_id AND public.user_owns_ad_account(auth.uid(), ad_account_id)));
CREATE POLICY "Update rd funnels" ON public.rd_funnels FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete rd funnels" ON public.rd_funnels FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE TRIGGER update_rd_funnels_updated_at BEFORE UPDATE ON public.rd_funnels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dashboard_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  scope text NOT NULL DEFAULT 'global',
  ad_account_id uuid NULL,
  layout jsonb NOT NULL DEFAULT '[]'::jsonb,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dashboard_views_user ON public.dashboard_views(user_id);
ALTER TABLE public.dashboard_views ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_views TO authenticated;
GRANT ALL ON public.dashboard_views TO service_role;
CREATE TRIGGER trg_dashboard_views_updated BEFORE UPDATE ON public.dashboard_views FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dashboard_view_state (
  user_id uuid NOT NULL,
  context_key text NOT NULL,
  view_id uuid NOT NULL REFERENCES public.dashboard_views(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, context_key)
);
ALTER TABLE public.dashboard_view_state ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_view_state TO authenticated;
GRANT ALL ON public.dashboard_view_state TO service_role;
CREATE POLICY "Users view own view state" ON public.dashboard_view_state FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own view state" ON public.dashboard_view_state FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own view state" ON public.dashboard_view_state FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own view state" ON public.dashboard_view_state FOR DELETE USING (auth.uid() = user_id);

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
CREATE POLICY "Users view own sync runs" ON public.sync_runs FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own sync runs" ON public.sync_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sync runs" ON public.sync_runs FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_sync_runs_user_started ON public.sync_runs(user_id, started_at DESC);

CREATE TABLE public.platform_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL,
  parent_platform text,
  match_field text NOT NULL,
  match_mode text NOT NULL DEFAULT 'contains',
  pattern text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  is_fallback boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_rules TO authenticated;
GRANT ALL ON public.platform_rules TO service_role;
CREATE POLICY "Users view own platform rules" ON public.platform_rules FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own platform rules" ON public.platform_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own platform rules" ON public.platform_rules FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users delete own platform rules" ON public.platform_rules FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_platform_rules_updated BEFORE UPDATE ON public.platform_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_platform_rules_user ON public.platform_rules(user_id, platform, priority);

CREATE TABLE public.insights_breakdowns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id text NOT NULL,
  date date NOT NULL,
  breakdown_type text NOT NULL,
  segment_key text NOT NULL,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  leads integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insights_breakdowns_unique UNIQUE (campaign_id, date, breakdown_type, segment_key)
);
CREATE INDEX idx_insights_breakdowns_campaign ON public.insights_breakdowns (campaign_id, breakdown_type, date);
ALTER TABLE public.insights_breakdowns ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights_breakdowns TO authenticated;
GRANT ALL ON public.insights_breakdowns TO service_role;
CREATE POLICY "View breakdowns" ON public.insights_breakdowns FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Insert breakdowns" ON public.insights_breakdowns FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Update breakdowns" ON public.insights_breakdowns FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Delete breakdowns" ON public.insights_breakdowns FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id));

CREATE TABLE public.insight_actions (
  ad_id text NOT NULL,
  date date NOT NULL,
  action_type text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  value_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, date, action_type)
);
CREATE INDEX idx_insight_actions_action_type ON public.insight_actions(action_type);
CREATE INDEX idx_insight_actions_date ON public.insight_actions(date);
ALTER TABLE public.insight_actions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insight_actions TO authenticated;
GRANT ALL ON public.insight_actions TO service_role;
CREATE POLICY "View insight_actions" ON public.insight_actions FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id));
CREATE POLICY "Insert insight_actions" ON public.insight_actions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id));
CREATE POLICY "Update insight_actions" ON public.insight_actions FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id));
CREATE POLICY "Delete insight_actions" ON public.insight_actions FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id));

CREATE TABLE public.custom_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('count','cost_per','rate')),
  numerator_action text,
  denominator_action text,
  denominator_field text,
  format text NOT NULL DEFAULT 'number' CHECK (format IN ('number','currency','percent')),
  is_default_lead boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_custom_metrics_user ON public.custom_metrics(user_id);
CREATE UNIQUE INDEX uniq_custom_metrics_default_lead ON public.custom_metrics(user_id) WHERE is_default_lead;
ALTER TABLE public.custom_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_metrics TO authenticated;
GRANT ALL ON public.custom_metrics TO service_role;
CREATE POLICY "View own custom_metrics" ON public.custom_metrics FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own custom_metrics" ON public.custom_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own custom_metrics" ON public.custom_metrics FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Delete own custom_metrics" ON public.custom_metrics FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_custom_metrics_updated_at BEFORE UPDATE ON public.custom_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lp_lead_action TEXT;

CREATE TABLE public.account_lead_action (
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'landing_page' CHECK (scope IN ('native_form', 'landing_page')),
  lp_lead_action text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_account_id, scope, lp_lead_action)
);
ALTER TABLE public.account_lead_action ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_lead_action TO authenticated;
GRANT ALL ON public.account_lead_action TO service_role;
CREATE POLICY "View account lead action" ON public.account_lead_action FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert account lead action" ON public.account_lead_action FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update account lead action" ON public.account_lead_action FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete account lead action" ON public.account_lead_action FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE TRIGGER update_account_lead_action_updated_at BEFORE UPDATE ON public.account_lead_action FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ad_account_pixel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  pixel_id text NOT NULL,
  name text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, pixel_id)
);
ALTER TABLE public.ad_account_pixel ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_account_pixel TO authenticated;
GRANT ALL ON public.ad_account_pixel TO service_role;
CREATE POLICY "View ad_account_pixel" ON public.ad_account_pixel FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert ad_account_pixel" ON public.ad_account_pixel FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update ad_account_pixel" ON public.ad_account_pixel FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete ad_account_pixel" ON public.ad_account_pixel FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TABLE public.pixel_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id uuid NOT NULL REFERENCES public.ad_account_pixel(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  action_type text NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pixel_id, action_type)
);
ALTER TABLE public.pixel_event ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pixel_event TO authenticated;
GRANT ALL ON public.pixel_event TO service_role;
CREATE POLICY "View pixel_event" ON public.pixel_event FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.ad_account_pixel p WHERE p.id = pixel_event.pixel_id AND public.user_owns_ad_account(auth.uid(), p.ad_account_id)));
CREATE POLICY "Insert pixel_event" ON public.pixel_event FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.ad_account_pixel p WHERE p.id = pixel_event.pixel_id AND public.user_owns_ad_account(auth.uid(), p.ad_account_id)));
CREATE POLICY "Update pixel_event" ON public.pixel_event FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.ad_account_pixel p WHERE p.id = pixel_event.pixel_id AND public.user_owns_ad_account(auth.uid(), p.ad_account_id)));
CREATE POLICY "Delete pixel_event" ON public.pixel_event FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.ad_account_pixel p WHERE p.id = pixel_event.pixel_id AND public.user_owns_ad_account(auth.uid(), p.ad_account_id)));

CREATE TABLE public.account_lp_config (
  ad_account_id uuid PRIMARY KEY REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  pixel_id uuid REFERENCES public.ad_account_pixel(id) ON DELETE SET NULL,
  action_type text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_lp_config ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_lp_config TO authenticated;
GRANT ALL ON public.account_lp_config TO service_role;
CREATE POLICY "View account_lp_config" ON public.account_lp_config FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert account_lp_config" ON public.account_lp_config FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update account_lp_config" ON public.account_lp_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete account_lp_config" ON public.account_lp_config FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TABLE public.insights_hourly (
  ad_account_id uuid NOT NULL,
  campaign_id text,
  ad_id text NOT NULL,
  date date NOT NULL,
  hour smallint NOT NULL CHECK (hour >= 0 AND hour <= 23),
  leads numeric NOT NULL DEFAULT 0,
  clicks numeric NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, date, hour)
);
CREATE INDEX idx_insights_hourly_account_date ON public.insights_hourly (ad_account_id, date);
CREATE INDEX idx_insights_hourly_campaign_date ON public.insights_hourly (campaign_id, date);
ALTER TABLE public.insights_hourly ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insights_hourly TO authenticated;
GRANT ALL ON public.insights_hourly TO service_role;
CREATE POLICY "View insights_hourly" ON public.insights_hourly FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert insights_hourly" ON public.insights_hourly FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update insights_hourly" ON public.insights_hourly FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete insights_hourly" ON public.insights_hourly FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TABLE public.rd_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  rd_funnel_id uuid NOT NULL,
  rd_deal_id text NOT NULL,
  rd_stage_id text,
  rd_stage_name text,
  rd_stage_order integer,
  stage_bucket text NOT NULL DEFAULT 'lead',
  win boolean NOT NULL DEFAULT false,
  lost_reason text,
  amount_total numeric DEFAULT 0,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  lead_state text,
  lead_city text,
  lead_created_at timestamptz,
  stage_updated_at timestamptz,
  closed_at timestamptz,
  raw jsonb,
  deal_owner_name text,
  rd_product_name text,
  contact_name text,
  contact_email text,
  first_touch_utm_campaign text,
  last_touch_utm_campaign text,
  touch_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rd_deal_id)
);
CREATE INDEX idx_rd_deals_funnel ON public.rd_deals (user_id, rd_funnel_id);
CREATE INDEX idx_rd_deals_bucket ON public.rd_deals (stage_bucket);
CREATE INDEX idx_rd_deals_lead_created ON public.rd_deals (lead_created_at);
CREATE INDEX idx_rd_deals_funnel_stage ON public.rd_deals(rd_funnel_id, rd_stage_order);
ALTER TABLE public.rd_deals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_deals TO authenticated;
GRANT ALL ON public.rd_deals TO service_role;
CREATE POLICY "View rd_deals" ON public.rd_deals FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert rd_deals" ON public.rd_deals FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update rd_deals" ON public.rd_deals FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete rd_deals" ON public.rd_deals FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE TRIGGER update_rd_deals_updated_at BEFORE UPDATE ON public.rd_deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rd_funnel_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_funnel_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rd_stage_id text NOT NULL,
  name text NOT NULL,
  nickname text,
  "order" integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (rd_funnel_id, rd_stage_id)
);
CREATE INDEX idx_rd_funnel_stages_funnel ON public.rd_funnel_stages(rd_funnel_id, "order");
ALTER TABLE public.rd_funnel_stages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_funnel_stages TO authenticated;
GRANT ALL ON public.rd_funnel_stages TO service_role;
CREATE POLICY "View rd_funnel_stages" ON public.rd_funnel_stages FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert rd_funnel_stages" ON public.rd_funnel_stages FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update rd_funnel_stages" ON public.rd_funnel_stages FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete rd_funnel_stages" ON public.rd_funnel_stages FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TABLE public.event_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  rd_funnel_id uuid NOT NULL,
  title text NOT NULL,
  date_start date NOT NULL,
  date_end date,
  location text,
  max_students integer NOT NULL DEFAULT 0,
  max_model_patients integer NOT NULL DEFAULT 0,
  max_people integer NOT NULL DEFAULT 0,
  has_model_patients boolean NOT NULL DEFAULT false,
  rd_model_patient_funnel_id uuid NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sold_out','upcoming','cancelled','finished')),
  allowed_student_stage_ids text[] NOT NULL DEFAULT '{}',
  allowed_model_patient_stage_ids text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_classes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_classes TO authenticated;
GRANT ALL ON public.event_classes TO service_role;
CREATE POLICY "View event_classes" ON public.event_classes FOR SELECT USING (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert event_classes" ON public.event_classes FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin') OR (auth.uid() = user_id AND public.user_owns_ad_account(auth.uid(), ad_account_id)));
CREATE POLICY "Update event_classes" ON public.event_classes FOR UPDATE USING (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete event_classes" ON public.event_classes FOR DELETE USING (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE TRIGGER trg_event_classes_updated BEFORE UPDATE ON public.event_classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_event_classes_funnel ON public.event_classes(rd_funnel_id);
CREATE INDEX idx_event_classes_account ON public.event_classes(ad_account_id);

CREATE TABLE public.event_class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  rd_deal_id text NOT NULL,
  member_type text NOT NULL CHECK (member_type IN ('student','model_patient')),
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (event_class_id, rd_deal_id, member_type)
);
ALTER TABLE public.event_class_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_class_members TO authenticated;
GRANT ALL ON public.event_class_members TO service_role;
CREATE POLICY "View event_class_members" ON public.event_class_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Insert event_class_members" ON public.event_class_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Update event_class_members" ON public.event_class_members FOR UPDATE USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Delete event_class_members" ON public.event_class_members FOR DELETE USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE INDEX idx_event_class_members_class ON public.event_class_members(event_class_id);
CREATE INDEX idx_event_class_members_deal ON public.event_class_members(rd_deal_id);

CREATE TABLE public.event_class_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_class_id uuid NOT NULL REFERENCES public.event_classes(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_class_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_class_history TO authenticated;
GRANT ALL ON public.event_class_history TO service_role;
CREATE POLICY "View event_class_history" ON public.event_class_history FOR SELECT USING (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE POLICY "Insert event_class_history" ON public.event_class_history FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.event_classes ec WHERE ec.id = event_class_id AND (public.has_role(auth.uid(),'admin') OR public.user_owns_ad_account(auth.uid(), ec.ad_account_id))));
CREATE INDEX idx_event_class_history_class ON public.event_class_history(event_class_id, created_at DESC);

CREATE TABLE public.rd_deal_touches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_deal_id text NOT NULL,
  ad_account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  touch_at timestamptz NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  matched_campaign_id text,
  touch_order integer NOT NULL DEFAULT 1,
  is_first boolean NOT NULL DEFAULT false,
  is_last boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rd_deal_touches_deal ON public.rd_deal_touches (rd_deal_id);
CREATE INDEX idx_rd_deal_touches_account_touch ON public.rd_deal_touches (ad_account_id, touch_at DESC);
CREATE INDEX idx_rd_deal_touches_campaign ON public.rd_deal_touches (matched_campaign_id);
CREATE UNIQUE INDEX uq_rd_deal_touches_dedup ON public.rd_deal_touches (rd_deal_id, touch_at, coalesce(utm_campaign,''), coalesce(utm_source,''), coalesce(utm_medium,''));
ALTER TABLE public.rd_deal_touches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rd_deal_touches TO authenticated;
GRANT ALL ON public.rd_deal_touches TO service_role;
CREATE POLICY "View rd_deal_touches" ON public.rd_deal_touches FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert rd_deal_touches" ON public.rd_deal_touches FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update rd_deal_touches" ON public.rd_deal_touches FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete rd_deal_touches" ON public.rd_deal_touches FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
