-- Keep the paid-traffic hierarchy responsive when a workspace has a large
-- Meta history. These indexes match the exact account, relationship, date and
-- ordering predicates used by the campaigns screen.
CREATE INDEX IF NOT EXISTS idx_campaigns_account_created_id
  ON public.campaigns (ad_account_id, created_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_adsets_campaign_name_id
  ON public.adsets (campaign_id, name ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_ads_adset_name_id
  ON public.ads (adset_id, name ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_insights_ad_date_attribution
  ON public.insights (ad_id, date ASC, attribution_window ASC);
