-- A raw pixel lead is not sufficient evidence that a site-lead funnel is active.
-- Only accounts with an explicitly configured non-form site event may count it.
-- Repair persisted totals for accounts without such a configuration; raw
-- insight_actions remain intact for audit and future account configuration.
UPDATE public.insights AS i
SET
  site_leads = 0,
  leads = COALESCE(i.form_leads, 0) + COALESCE(i.conversations, 0),
  cpl = CASE
    WHEN COALESCE(i.form_leads, 0) + COALESCE(i.conversations, 0) > 0
      THEN COALESCE(i.spend, 0) / (COALESCE(i.form_leads, 0) + COALESCE(i.conversations, 0))
    ELSE 0
  END,
  conversion_rate = CASE
    WHEN COALESCE(i.clicks, 0) > 0
      THEN ((COALESCE(i.form_leads, 0) + COALESCE(i.conversations, 0)) / i.clicks) * 100
    ELSE 0
  END,
  efficiency_rate = CASE
    WHEN COALESCE(i.impressions, 0) > 0
      THEN ((COALESCE(i.form_leads, 0) + COALESCE(i.conversations, 0)) / i.impressions) * 100
    ELSE 0
  END
WHERE NOT EXISTS (
  SELECT 1
  FROM public.account_lp_config AS config
  WHERE config.ad_account_id = i.ad_account_id
    AND config.action_type IS NOT NULL
    AND config.action_type NOT IN (
      'onsite_conversion.lead_grouped', 'leadgen_grouped',
      'onsite_conversion.lead', 'leadgen.other', 'omni_lead', 'lead'
    )
)
AND (
  COALESCE(i.site_leads, 0) <> 0
  OR COALESCE(i.leads, 0) <> COALESCE(i.form_leads, 0) + COALESCE(i.conversations, 0)
);
