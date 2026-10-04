-- Repair legacy Meta facts whose owner was not persisted. Ownership is only
-- backfilled when the ad -> adset -> campaign hierarchy resolves it exactly.
-- Unresolvable facts remain unassigned and must not be guessed by name.

UPDATE public.insights AS insight
SET ad_account_id = campaign.ad_account_id,
    campaign_id = COALESCE(insight.campaign_id, campaign.id),
    campaign_name = COALESCE(insight.campaign_name, campaign.name),
    adset_id = COALESCE(insight.adset_id, adset.id),
    adset_name = COALESCE(insight.adset_name, adset.name)
FROM public.ads AS ad
JOIN public.adsets AS adset ON adset.id = ad.adset_id
JOIN public.campaigns AS campaign ON campaign.id = adset.campaign_id
WHERE insight.ad_id = ad.id
  AND insight.ad_account_id IS NULL;

UPDATE public.insight_actions AS action
SET ad_account_id = COALESCE(insight.ad_account_id, campaign.ad_account_id),
    timezone = COALESCE(NULLIF(action.timezone, ''), account.timezone_name, 'America/Sao_Paulo')
FROM public.insights AS insight
JOIN public.ads AS ad ON ad.id = insight.ad_id
JOIN public.adsets AS adset ON adset.id = ad.adset_id
JOIN public.campaigns AS campaign ON campaign.id = adset.campaign_id
JOIN public.ad_accounts AS account ON account.id = campaign.ad_account_id
WHERE action.ad_id = insight.ad_id
  AND action.date = insight.date
  AND action.ad_account_id IS NULL
  AND COALESCE(action.attribution_window, 'account_default') = COALESCE(insight.attribution_window, 'account_default');

CREATE INDEX IF NOT EXISTS idx_insights_account_date_attribution
  ON public.insights (ad_account_id, date, attribution_window);

CREATE INDEX IF NOT EXISTS idx_insight_actions_account_date_attribution
  ON public.insight_actions (ad_account_id, date, attribution_window);
