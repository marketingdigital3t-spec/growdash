-- Preserve provider-supplied UTM attribution in the Meta tracking columns when
-- RD creates a deal without a deterministic native Meta Lead match. This is
-- useful for RD/Meta developer tests and for live forms whose resolved UTM
-- values arrive before the Meta webhook. Literal {{...}} macros are ignored.
CREATE OR REPLACE FUNCTION public.fill_rd_deal_utm_meta_tracking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  utm_campaign_value text;
  utm_adset_value text;
  utm_ad_value text;
  utm_platform_value text;
BEGIN
  utm_campaign_value := CASE
    WHEN btrim(coalesce(NEW.utm_campaign, '')) ~ '^\\{\\{[^{}]+\\}\\}$' THEN NULL
    ELSE NULLIF(btrim(NEW.utm_campaign), '')
  END;
  utm_adset_value := CASE
    WHEN btrim(coalesce(NEW.utm_term, '')) ~ '^\\{\\{[^{}]+\\}\\}$' THEN NULL
    ELSE NULLIF(btrim(NEW.utm_term), '')
  END;
  utm_ad_value := CASE
    WHEN btrim(coalesce(NEW.utm_content, '')) ~ '^\\{\\{[^{}]+\\}\\}$' THEN NULL
    ELSE NULLIF(btrim(NEW.utm_content), '')
  END;
  utm_platform_value := CASE lower(NULLIF(btrim(NEW.utm_source), ''))
    WHEN 'facebook' THEN 'fb'
    WHEN 'fb' THEN 'fb'
    WHEN 'instagram' THEN 'ig'
    WHEN 'ig' THEN 'ig'
    ELSE NULL
  END;

  NEW.meta_campaign_name := coalesce(NULLIF(btrim(NEW.meta_campaign_name), ''), utm_campaign_value);
  NEW.meta_adset_name := coalesce(NULLIF(btrim(NEW.meta_adset_name), ''), utm_adset_value);
  NEW.meta_ad_name := coalesce(NULLIF(btrim(NEW.meta_ad_name), ''), utm_ad_value);
  NEW.meta_platform := coalesce(NULLIF(btrim(NEW.meta_platform), ''), utm_platform_value);

  IF coalesce(NULLIF(btrim(NEW.meta_attribution_method), ''), '') = ''
     AND (
       NEW.meta_campaign_name IS NOT NULL
       OR NEW.meta_adset_name IS NOT NULL
       OR NEW.meta_ad_name IS NOT NULL
       OR NEW.meta_platform IS NOT NULL
     ) THEN
    NEW.meta_attribution_method := 'rd_utm_fields';
  END IF;

  IF coalesce(NULLIF(btrim(NEW.meta_attribution_status), ''), '') = ''
     AND coalesce(NULLIF(btrim(NEW.meta_attribution_method), ''), '') = 'rd_utm_fields' THEN
    NEW.meta_attribution_status := 'partial';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_rd_deal_utm_meta_tracking ON public.rd_deals;
CREATE TRIGGER trg_fill_rd_deal_utm_meta_tracking
BEFORE INSERT OR UPDATE OF utm_source, utm_medium, utm_campaign, utm_term, utm_content
ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.fill_rd_deal_utm_meta_tracking();

-- Backfill only missing derived fields. Existing native Meta attribution and
-- manual values remain authoritative.
UPDATE public.rd_deals
SET meta_campaign_name = coalesce(NULLIF(btrim(meta_campaign_name), ''), CASE
      WHEN btrim(coalesce(utm_campaign, '')) ~ '^\\{\\{[^{}]+\\}\\}$' THEN NULL
      ELSE NULLIF(btrim(utm_campaign), '')
    END),
    meta_adset_name = coalesce(NULLIF(btrim(meta_adset_name), ''), CASE
      WHEN btrim(coalesce(utm_term, '')) ~ '^\\{\\{[^{}]+\\}\\}$' THEN NULL
      ELSE NULLIF(btrim(utm_term), '')
    END),
    meta_ad_name = coalesce(NULLIF(btrim(meta_ad_name), ''), CASE
      WHEN btrim(coalesce(utm_content, '')) ~ '^\\{\\{[^{}]+\\}\\}$' THEN NULL
      ELSE NULLIF(btrim(utm_content), '')
    END),
    meta_platform = coalesce(NULLIF(btrim(meta_platform), ''), CASE lower(NULLIF(btrim(utm_source), ''))
      WHEN 'facebook' THEN 'fb'
      WHEN 'fb' THEN 'fb'
      WHEN 'instagram' THEN 'ig'
      WHEN 'ig' THEN 'ig'
      ELSE NULL
    END),
    meta_attribution_method = CASE
      WHEN coalesce(NULLIF(btrim(meta_attribution_method), ''), '') <> '' THEN meta_attribution_method
      WHEN meta_campaign_name IS NOT NULL OR meta_adset_name IS NOT NULL OR meta_ad_name IS NOT NULL OR meta_platform IS NOT NULL
        THEN 'rd_utm_fields'
      ELSE NULL
    END,
    meta_attribution_status = CASE
      WHEN coalesce(NULLIF(btrim(meta_attribution_status), ''), '') <> '' THEN meta_attribution_status
      WHEN coalesce(NULLIF(btrim(meta_attribution_method), ''), '') = 'rd_utm_fields' THEN 'partial'
      ELSE NULL
    END
WHERE meta_campaign_name IS NULL
   OR meta_adset_name IS NULL
   OR meta_ad_name IS NULL
   OR meta_platform IS NULL
   OR meta_attribution_method IS NULL
   OR meta_attribution_status IS NULL;

REVOKE ALL ON FUNCTION public.fill_rd_deal_utm_meta_tracking() FROM PUBLIC;
