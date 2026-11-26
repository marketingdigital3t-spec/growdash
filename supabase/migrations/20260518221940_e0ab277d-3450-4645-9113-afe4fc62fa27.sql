
CREATE TABLE public.user_permissions (
  user_id UUID NOT NULL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  can_dashboard BOOLEAN NOT NULL DEFAULT false,
  can_campaigns BOOLEAN NOT NULL DEFAULT false,
  can_funnels BOOLEAN NOT NULL DEFAULT false,
  can_classes BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master manages user_permissions"
ON public.user_permissions FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Users view own permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_permissions_updated
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.user_ad_account_access (
  user_id UUID NOT NULL,
  ad_account_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ad_account_id)
);

ALTER TABLE public.user_ad_account_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master manages ad account access"
ON public.user_ad_account_access FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Users view own ad account access"
ON public.user_ad_account_access FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


CREATE TABLE public.user_rd_funnel_access (
  user_id UUID NOT NULL,
  rd_funnel_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rd_funnel_id)
);

ALTER TABLE public.user_rd_funnel_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master manages rd funnel access"
ON public.user_rd_funnel_access FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

CREATE POLICY "Users view own rd funnel access"
ON public.user_rd_funnel_access FOR SELECT
TO authenticated
USING (auth.uid() = user_id);


CREATE OR REPLACE FUNCTION public.user_has_page(_user_id UUID, _page TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_master(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions p
      WHERE p.user_id = _user_id
        AND (
          (_page = 'dashboard' AND p.can_dashboard) OR
          (_page = 'campaigns' AND p.can_campaigns) OR
          (_page = 'funnels' AND p.can_funnels) OR
          (_page = 'classes' AND p.can_classes)
        )
    )
$$;
