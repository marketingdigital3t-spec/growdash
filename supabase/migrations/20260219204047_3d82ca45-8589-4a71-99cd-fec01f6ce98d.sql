
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  email_alerts_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Ad accounts table
CREATE TABLE public.ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Campaigns table
CREATE TABLE public.campaigns (
  id TEXT PRIMARY KEY,
  ad_account_id UUID REFERENCES public.ad_accounts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Adsets table
CREATE TABLE public.adsets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  daily_budget NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ads table
CREATE TABLE public.ads (
  id TEXT PRIMARY KEY,
  adset_id TEXT REFERENCES public.adsets(id) ON DELETE CASCADE NOT NULL,
  creative_id TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Insights table (daily metrics per ad)
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
  UNIQUE(ad_id, date)
);

-- Alerts table
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

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Helper: check if user has a role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user owns an ad account
CREATE OR REPLACE FUNCTION public.user_owns_ad_account(_user_id UUID, _ad_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ad_accounts
    WHERE id = _ad_account_id AND user_id = _user_id
  )
$$;

-- Helper: check if user can access campaign (via ad_account ownership)
CREATE OR REPLACE FUNCTION public.user_can_access_campaign(_user_id UUID, _campaign_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    JOIN public.ad_accounts aa ON aa.id = c.ad_account_id
    WHERE c.id = _campaign_id AND aa.user_id = _user_id
  )
$$;

-- Helper: check if user can access ad (via chain)
CREATE OR REPLACE FUNCTION public.user_can_access_ad(_user_id UUID, _ad_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ads a
    JOIN public.adsets ast ON ast.id = a.adset_id
    JOIN public.campaigns c ON c.id = ast.campaign_id
    JOIN public.ad_accounts aa ON aa.id = c.ad_account_id
    WHERE a.id = _ad_id AND aa.user_id = _user_id
  )
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ad_accounts_updated_at BEFORE UPDATE ON public.ad_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_adsets_updated_at BEFORE UPDATE ON public.adsets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies: user_roles
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can manage roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can update roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admins can delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies: ad_accounts
CREATE POLICY "Users can view own ad accounts" ON public.ad_accounts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create ad accounts" ON public.ad_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ad accounts" ON public.ad_accounts FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own ad accounts" ON public.ad_accounts FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- RLS Policies: campaigns
CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), id));
CREATE POLICY "Users can insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), id));
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), id));

-- RLS Policies: adsets
CREATE POLICY "Users can view own adsets" ON public.adsets FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id)
);
CREATE POLICY "Users can insert adsets" ON public.adsets FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id)
);
CREATE POLICY "Users can update own adsets" ON public.adsets FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id)
);
CREATE POLICY "Users can delete own adsets" ON public.adsets FOR DELETE USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_campaign(auth.uid(), campaign_id)
);

-- RLS Policies: ads
CREATE POLICY "Users can view own ads" ON public.ads FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), id)
);
CREATE POLICY "Users can insert ads" ON public.ads FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.adsets ast JOIN public.campaigns c ON c.id = ast.campaign_id JOIN public.ad_accounts aa ON aa.id = c.ad_account_id WHERE ast.id = adset_id AND aa.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update own ads" ON public.ads FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), id)
);
CREATE POLICY "Users can delete own ads" ON public.ads FOR DELETE USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), id)
);

-- RLS Policies: insights
CREATE POLICY "Users can view own insights" ON public.insights FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id)
);
CREATE POLICY "Users can insert insights" ON public.insights FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_ad(auth.uid(), ad_id)
);

-- RLS Policies: alerts
CREATE POLICY "Users can view own alerts" ON public.alerts FOR SELECT USING (
  auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users can create alerts" ON public.alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.alerts FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete own alerts" ON public.alerts FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_insights_ad_date ON public.insights(ad_id, date);
CREATE INDEX idx_alerts_user ON public.alerts(user_id, is_read);
CREATE INDEX idx_ad_accounts_user ON public.ad_accounts(user_id);
CREATE INDEX idx_campaigns_account ON public.campaigns(ad_account_id);
CREATE INDEX idx_adsets_campaign ON public.adsets(campaign_id);
CREATE INDEX idx_ads_adset ON public.ads(adset_id);
