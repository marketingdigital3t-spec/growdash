
-- 1. Master/platform owner functions (precisam vir antes das policies)
CREATE OR REPLACE FUNCTION public.is_platform_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id AND lower(u.email) = 'marketingdigital3t@gmail.com')
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_owner(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master'::app_role)
$$;

-- 2. user_permissions
CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id UUID NOT NULL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  can_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_campaigns BOOLEAN NOT NULL DEFAULT false,
  can_funnels BOOLEAN NOT NULL DEFAULT false,
  can_classes BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master manages user_permissions" ON public.user_permissions FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Users view own permissions" ON public.user_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE TRIGGER trg_user_permissions_updated BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. user_ad_account_access
CREATE TABLE IF NOT EXISTS public.user_ad_account_access (
  user_id UUID NOT NULL,
  ad_account_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ad_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ad_account_access TO authenticated;
GRANT ALL ON public.user_ad_account_access TO service_role;
ALTER TABLE public.user_ad_account_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master manages ad account access" ON public.user_ad_account_access FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Users view own ad account access" ON public.user_ad_account_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. user_rd_funnel_access
CREATE TABLE IF NOT EXISTS public.user_rd_funnel_access (
  user_id UUID NOT NULL,
  rd_funnel_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rd_funnel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_rd_funnel_access TO authenticated;
GRANT ALL ON public.user_rd_funnel_access TO service_role;
ALTER TABLE public.user_rd_funnel_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master manages rd funnel access" ON public.user_rd_funnel_access FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Users view own rd funnel access" ON public.user_rd_funnel_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_has_page(_user_id UUID, _page TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_master(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_permissions p WHERE p.user_id = _user_id AND (
      (_page = 'dashboard' AND p.can_dashboard) OR
      (_page = 'campaigns' AND p.can_campaigns) OR
      (_page = 'funnels' AND p.can_funnels) OR
      (_page = 'classes' AND p.can_classes)
    )
  )
$$;

-- 5. account_utm_mapping
CREATE TABLE IF NOT EXISTS public.account_utm_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL UNIQUE,
  campaign_utm text NOT NULL DEFAULT 'utm_campaign',
  adset_utm text NOT NULL DEFAULT 'utm_term',
  creative_utm text NOT NULL DEFAULT 'utm_content',
  platform_utm text NOT NULL DEFAULT 'utm_source',
  match_strategy text NOT NULL DEFAULT 'normalized',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_utm_mapping TO authenticated;
GRANT ALL ON public.account_utm_mapping TO service_role;
ALTER TABLE public.account_utm_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View account_utm_mapping" ON public.account_utm_mapping FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert account_utm_mapping" ON public.account_utm_mapping FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update account_utm_mapping" ON public.account_utm_mapping FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete account_utm_mapping" ON public.account_utm_mapping FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE TRIGGER update_account_utm_mapping_updated_at BEFORE UPDATE ON public.account_utm_mapping
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS manual_campaign_id text,
  ADD COLUMN IF NOT EXISTS manual_adset_id text,
  ADD COLUMN IF NOT EXISTS manual_ad_id text,
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false;

INSERT INTO public.account_utm_mapping (ad_account_id)
SELECT id FROM public.ad_accounts ON CONFLICT (ad_account_id) DO NOTHING;

-- 6. realtime_sync_state
CREATE TABLE IF NOT EXISTS public.realtime_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  scope_key text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, scope_key)
);
GRANT SELECT ON public.realtime_sync_state TO authenticated;
GRANT ALL ON public.realtime_sync_state TO service_role;
ALTER TABLE public.realtime_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own realtime sync state" ON public.realtime_sync_state FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role));
CREATE INDEX IF NOT EXISTS idx_realtime_sync_state_user_provider
  ON public.realtime_sync_state (user_id, provider, scope_key);

-- 7. platform_announcements
CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_data_url text NOT NULL,
  alt text NOT NULL DEFAULT 'Anúncio Trackvio',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_announcements TO authenticated;
GRANT ALL ON public.platform_announcements TO service_role;
CREATE UNIQUE INDEX IF NOT EXISTS platform_announcements_single_active_idx
  ON public.platform_announcements (active) WHERE active = true;
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read active announcements" ON public.platform_announcements FOR SELECT TO authenticated
  USING (active = true OR public.is_master(auth.uid()));
CREATE POLICY "Only masters can create announcements" ON public.platform_announcements FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Only masters can update announcements" ON public.platform_announcements FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));
CREATE POLICY "Only masters can delete announcements" ON public.platform_announcements FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()));
