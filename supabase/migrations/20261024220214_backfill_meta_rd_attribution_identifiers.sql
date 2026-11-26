-- Re-run-safe historical repair for RD rows imported before the Meta account
-- mapping existed. Only exact-account matches or unique identifier matches are
-- allowed; ambiguous contacts remain untouched for manual review.
WITH candidates AS (
  SELECT
    d.id AS deal_id,
    m.meta_lead_id,
    m.form_id,
    m.campaign_id,
    m.adset_id,
    m.ad_id,
    m.campaign_name,
    m.adset_name,
    m.ad_name,
    m.form_name,
    m.platform,
    m.placement,
    m.is_organic,
    count(*) OVER (PARTITION BY d.id) AS candidate_count,
    max(CASE WHEN d.ad_account_id IS NOT NULL AND d.ad_account_id = m.ad_account_id THEN 1 ELSE 0 END) OVER (PARTITION BY d.id) AS exact_account,
    row_number() OVER (
      PARTITION BY d.id
      ORDER BY
        CASE WHEN d.ad_account_id IS NOT NULL AND d.ad_account_id = m.ad_account_id THEN 0 ELSE 1 END,
        CASE WHEN d.contact_email IS NOT NULL AND m.email IS NOT NULL AND lower(trim(d.contact_email)) = lower(trim(m.email))
               AND d.contact_phone IS NOT NULL AND m.phone IS NOT NULL
               AND public.growdash_normalize_phone(d.contact_phone) = public.growdash_normalize_phone(m.phone) THEN 0
             WHEN d.contact_email IS NOT NULL AND m.email IS NOT NULL AND lower(trim(d.contact_email)) = lower(trim(m.email)) THEN 1
             ELSE 2 END,
        m.created_time DESC
    ) AS rank
  FROM public.rd_deals d
  JOIN public.meta_leads m
    ON ((d.contact_email IS NOT NULL AND m.email IS NOT NULL AND lower(trim(d.contact_email)) = lower(trim(m.email)))
      OR (d.contact_phone IS NOT NULL AND m.phone IS NOT NULL AND public.growdash_normalize_phone(d.contact_phone) = public.growdash_normalize_phone(m.phone)))
   AND m.created_time <= coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now())
   AND m.created_time >= coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) - interval '180 days'
  WHERE d.meta_lead_id IS NULL
), chosen AS (
  SELECT * FROM candidates WHERE rank = 1 AND (exact_account = 1 OR candidate_count = 1)
)
UPDATE public.rd_deals d
   SET meta_lead_id = c.meta_lead_id,
       meta_form_id = c.form_id,
       meta_campaign_id = c.campaign_id,
       meta_adset_id = c.adset_id,
       meta_ad_id = c.ad_id,
       meta_attribution_method = CASE WHEN c.exact_account = 1 THEN 'meta_form_identifier_exact' ELSE 'meta_form_identifier_fallback' END,
       meta_attributed_at = now(),
       meta_campaign_name = c.campaign_name,
       meta_adset_name = c.adset_name,
       meta_ad_name = c.ad_name,
       meta_form_name = c.form_name,
       meta_platform = c.platform,
       meta_placement = c.placement,
       meta_is_organic = c.is_organic,
       meta_attribution_status = CASE
         WHEN c.campaign_id IS NOT NULL AND c.adset_id IS NOT NULL AND c.ad_id IS NOT NULL AND c.form_id IS NOT NULL
          AND nullif(btrim(c.campaign_name), '') IS NOT NULL AND nullif(btrim(c.adset_name), '') IS NOT NULL
          AND nullif(btrim(c.ad_name), '') IS NOT NULL AND nullif(btrim(c.form_name), '') IS NOT NULL
          AND nullif(btrim(c.platform), '') IS NOT NULL AND nullif(btrim(c.placement), '') IS NOT NULL THEN 'exact'
         ELSE 'partial'
       END,
       updated_at = now()
  FROM chosen c
 WHERE d.id = c.deal_id;
