
CREATE OR REPLACE FUNCTION public.user_can_view_ad_account(_user_id UUID, _ad_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.user_owns_ad_account(_user_id, _ad_account_id)
    OR public.is_master(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_ad_account_access
      WHERE user_id = _user_id AND ad_account_id = _ad_account_id
    )
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_campaign(_user_id UUID, _campaign_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = _campaign_id
      AND public.user_can_view_ad_account(_user_id, c.ad_account_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_ad(_user_id UUID, _ad_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ads a
    JOIN public.adsets ast ON ast.id = a.adset_id
    JOIN public.campaigns c ON c.id = ast.campaign_id
    WHERE a.id = _ad_id
      AND public.user_can_view_ad_account(_user_id, c.ad_account_id)
  )
$$;

-- Read-only SELECT policies for assigned users
CREATE POLICY "Assigned users view ad_accounts"
ON public.ad_accounts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_ad_account_access a
  WHERE a.user_id = auth.uid() AND a.ad_account_id = id));

CREATE POLICY "Assigned users view campaigns"
ON public.campaigns FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_ad_account_access a
  WHERE a.user_id = auth.uid() AND a.ad_account_id = campaigns.ad_account_id));

CREATE POLICY "Assigned users view adsets"
ON public.adsets FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  JOIN public.user_ad_account_access a ON a.ad_account_id = c.ad_account_id
  WHERE c.id = adsets.campaign_id AND a.user_id = auth.uid()
));

CREATE POLICY "Assigned users view ads"
ON public.ads FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.adsets ast
  JOIN public.campaigns c ON c.id = ast.campaign_id
  JOIN public.user_ad_account_access a ON a.ad_account_id = c.ad_account_id
  WHERE ast.id = ads.adset_id AND a.user_id = auth.uid()
));

CREATE POLICY "Assigned users view insights"
ON public.insights FOR SELECT TO authenticated
USING (public.user_can_view_ad(auth.uid(), ad_id));

CREATE POLICY "Assigned users view insights_breakdowns"
ON public.insights_breakdowns FOR SELECT TO authenticated
USING (public.user_can_view_campaign(auth.uid(), campaign_id));

CREATE POLICY "Assigned users view insights_hourly"
ON public.insights_hourly FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_ad_account_access a
  WHERE a.user_id = auth.uid() AND a.ad_account_id = insights_hourly.ad_account_id));

CREATE POLICY "Assigned users view insight_actions"
ON public.insight_actions FOR SELECT TO authenticated
USING (public.user_can_view_ad(auth.uid(), ad_id));

CREATE POLICY "Assigned users view rd_deals"
ON public.rd_deals FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_rd_funnel_access f
    WHERE f.user_id = auth.uid() AND f.rd_funnel_id = rd_deals.rd_funnel_id)
);

CREATE POLICY "Assigned users view rd_deal_touches"
ON public.rd_deal_touches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_ad_account_access a
  WHERE a.user_id = auth.uid() AND a.ad_account_id = rd_deal_touches.ad_account_id));

CREATE POLICY "Assigned users view rd_funnels"
ON public.rd_funnels FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_rd_funnel_access f
  WHERE f.user_id = auth.uid() AND f.rd_funnel_id = rd_funnels.id));

CREATE POLICY "Assigned users view rd_funnel_stages"
ON public.rd_funnel_stages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_rd_funnel_access f
  WHERE f.user_id = auth.uid() AND f.rd_funnel_id = rd_funnel_stages.rd_funnel_id));

CREATE POLICY "Assigned users view event_classes"
ON public.event_classes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_ad_account_access a
  WHERE a.user_id = auth.uid() AND a.ad_account_id = event_classes.ad_account_id));
