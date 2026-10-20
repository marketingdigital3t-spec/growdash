-- Macro placeholders are not attribution facts. They are produced when an ad
-- URL uses an unsupported Meta token (for example {{ad_name}}), and storing
-- them makes the CRM look as if an ad was received when it was not.
UPDATE public.meta_leads
   SET campaign_name = CASE WHEN campaign_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(campaign_name), '') END,
       adset_name = CASE WHEN adset_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(adset_name), '') END,
       ad_name = CASE WHEN ad_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(ad_name), '') END,
       form_name = CASE WHEN form_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(form_name), '') END,
       platform = CASE WHEN platform ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(platform), '') END,
       placement = CASE WHEN placement ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(placement), '') END
 WHERE campaign_name ~ '^\{\{[^{}]+\}\}$'
    OR adset_name ~ '^\{\{[^{}]+\}\}$'
    OR ad_name ~ '^\{\{[^{}]+\}\}$'
    OR form_name ~ '^\{\{[^{}]+\}\}$'
    OR platform ~ '^\{\{[^{}]+\}\}$'
    OR placement ~ '^\{\{[^{}]+\}\}$';

UPDATE public.rd_deals
   SET meta_campaign_name = CASE WHEN meta_campaign_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(meta_campaign_name), '') END,
       meta_adset_name = CASE WHEN meta_adset_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(meta_adset_name), '') END,
       meta_ad_name = CASE WHEN meta_ad_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(meta_ad_name), '') END,
       meta_form_name = CASE WHEN meta_form_name ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(meta_form_name), '') END,
       meta_platform = CASE WHEN meta_platform ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(meta_platform), '') END,
       meta_placement = CASE WHEN meta_placement ~ '^\{\{[^{}]+\}\}$' THEN NULL ELSE NULLIF(btrim(meta_placement), '') END
 WHERE meta_campaign_name ~ '^\{\{[^{}]+\}\}$'
    OR meta_adset_name ~ '^\{\{[^{}]+\}\}$'
    OR meta_ad_name ~ '^\{\{[^{}]+\}\}$'
    OR meta_form_name ~ '^\{\{[^{}]+\}\}$'
    OR meta_platform ~ '^\{\{[^{}]+\}\}$'
    OR meta_placement ~ '^\{\{[^{}]+\}\}$';

-- Keep the readable CRM custom-field mirror free of the same invalid macros;
-- raw remains the immutable provider snapshot for audit.
UPDATE public.rd_deals d
   SET custom_fields = COALESCE(
     (
       SELECT jsonb_object_agg(item.key, item.value)
         FROM jsonb_each_text(CASE WHEN jsonb_typeof(d.custom_fields) = 'object' THEN d.custom_fields ELSE '{}'::jsonb END) item
        WHERE NOT (
          item.key ~* '^(utm_|meta_)(source|medium|campaign|term|content|id|campaign_name|adset_name|ad_name|form_name|platform|placement)$'
          AND item.value ~ '^\{\{[^{}]+\}\}$'
        )
     ),
     '{}'::jsonb
   )
 WHERE jsonb_typeof(d.custom_fields) = 'object'
   AND EXISTS (
     SELECT 1
       FROM jsonb_each_text(d.custom_fields) item
      WHERE item.key ~* '^(utm_|meta_)(source|medium|campaign|term|content|id|campaign_name|adset_name|ad_name|form_name|platform|placement)$'
        AND item.value ~ '^\{\{[^{}]+\}\}$'
   );
