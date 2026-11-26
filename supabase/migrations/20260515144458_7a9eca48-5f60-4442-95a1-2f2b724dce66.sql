-- Backfill: recalcular insights.leads dos últimos 90 dias usando SOMENTE
-- onsite_conversion.lead_grouped + LP configurada por conta.
-- Elimina o evento `lead` (inflado ~3x) e `fb_pixel_lead` (que não é instantâneo).

WITH per_ad AS (
  SELECT
    i.ad_id,
    i.date,
    -- Formulário Instantâneo (sempre)
    COALESCE(SUM(CASE WHEN ia.action_type = 'onsite_conversion.lead_grouped' THEN ia.value END), 0) AS native_leads,
    -- Landing Page configurada para a conta dona deste ad (se houver)
    COALESCE(SUM(CASE WHEN ia.action_type = lp.action_type AND lp.action_type IS NOT NULL THEN ia.value END), 0) AS lp_leads
  FROM public.insights i
  JOIN public.ads a   ON a.id  = i.ad_id
  JOIN public.adsets s ON s.id  = a.adset_id
  JOIN public.campaigns c ON c.id = s.campaign_id
  LEFT JOIN public.account_lp_config lp ON lp.ad_account_id = c.ad_account_id
  LEFT JOIN public.insight_actions ia ON ia.ad_id = i.ad_id AND ia.date = i.date
  WHERE i.date >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY i.ad_id, i.date
)
UPDATE public.insights i
SET
  leads = pa.native_leads + pa.lp_leads,
  cpl = CASE WHEN (pa.native_leads + pa.lp_leads) > 0
             THEN i.spend / (pa.native_leads + pa.lp_leads)
             ELSE 0 END,
  conversion_rate = CASE WHEN i.clicks > 0
                         THEN ((pa.native_leads + pa.lp_leads)::numeric / i.clicks) * 100
                         ELSE 0 END,
  efficiency_rate = CASE WHEN i.impressions > 0
                         THEN ((pa.native_leads + pa.lp_leads)::numeric / i.impressions) * 100
                         ELSE 0 END
FROM per_ad pa
WHERE i.ad_id = pa.ad_id AND i.date = pa.date;