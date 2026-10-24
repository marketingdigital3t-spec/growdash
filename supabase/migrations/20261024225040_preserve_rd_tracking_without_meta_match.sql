-- RD can receive valid UTM/meta tracking even when the contact cannot be
-- matched to a native Meta Lead Ads row (developer tests and click-to-message
-- contacts are common examples). The previous trigger cleared those values
-- before attempting the identifier match, leaving only the campaign fallback
-- visible in the CRM.
CREATE OR REPLACE FUNCTION public.link_rd_deal_to_meta_form_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate public.meta_leads%ROWTYPE;
  reference_at timestamptz;
  email_key text := lower(nullif(btrim(NEW.contact_email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.contact_phone);
  email_matches boolean;
  phone_matches boolean;
  candidate_count integer := 0;
  exact_account_match boolean := false;
  had_automatic_meta_match boolean := coalesce(NEW.meta_attribution_method, '') LIKE 'meta_form_%';
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.ad_account_id IS NOT DISTINCT FROM OLD.ad_account_id
    AND NEW.contact_email IS NOT DISTINCT FROM OLD.contact_email
    AND NEW.contact_phone IS NOT DISTINCT FROM OLD.contact_phone
    AND NEW.lead_created_at IS NOT DISTINCT FROM OLD.lead_created_at
  THEN
    RETURN NEW;
  END IF;

  -- Keep provider-supplied tracking values while the deterministic identity
  -- lookup runs. Only an old automatic Meta match is cleared when it can no
  -- longer be justified by the new contact identity.
  IF email_key IS NULL AND phone_key IS NULL THEN
    IF had_automatic_meta_match THEN
      NEW.meta_lead_id := NULL;
      NEW.meta_form_id := NULL;
      NEW.meta_campaign_id := NULL;
      NEW.meta_adset_id := NULL;
      NEW.meta_ad_id := NULL;
      NEW.meta_attribution_method := NULL;
      NEW.meta_attributed_at := NULL;
      NEW.meta_campaign_name := NULL;
      NEW.meta_adset_name := NULL;
      NEW.meta_ad_name := NULL;
      NEW.meta_form_name := NULL;
      NEW.meta_platform := NULL;
      NEW.meta_placement := NULL;
      NEW.meta_is_organic := NULL;
      NEW.meta_attribution_status := NULL;
    END IF;
    RETURN NEW;
  END IF;

  reference_at := coalesce(NEW.lead_created_at, NEW.stage_updated_at, NEW.closed_at, now());

  IF NEW.ad_account_id IS NOT NULL THEN
    SELECT m.* INTO candidate
      FROM public.meta_leads m
     WHERE m.ad_account_id = NEW.ad_account_id
       AND m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND ((email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key)
         OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key))
     ORDER BY CASE
        WHEN email_key IS NOT NULL AND phone_key IS NOT NULL
          AND lower(nullif(btrim(m.email), '')) = email_key
          AND public.growdash_normalize_phone(m.phone) = phone_key THEN 0
        WHEN email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key THEN 1
        ELSE 2 END,
        m.created_time DESC
     LIMIT 1;
    exact_account_match := FOUND;
  END IF;

  IF NOT exact_account_match THEN
    SELECT count(*) INTO candidate_count
      FROM public.meta_leads m
     WHERE m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND ((email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key)
         OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key));
    IF candidate_count <> 1 THEN
      IF had_automatic_meta_match THEN
        NEW.meta_lead_id := NULL;
        NEW.meta_form_id := NULL;
        NEW.meta_campaign_id := NULL;
        NEW.meta_adset_id := NULL;
        NEW.meta_ad_id := NULL;
        NEW.meta_attribution_method := NULL;
        NEW.meta_attributed_at := NULL;
        NEW.meta_campaign_name := NULL;
        NEW.meta_adset_name := NULL;
        NEW.meta_ad_name := NULL;
        NEW.meta_form_name := NULL;
        NEW.meta_platform := NULL;
        NEW.meta_placement := NULL;
        NEW.meta_is_organic := NULL;
        NEW.meta_attribution_status := NULL;
      END IF;
      RETURN NEW;
    END IF;
    SELECT m.* INTO candidate
      FROM public.meta_leads m
     WHERE m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND ((email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key)
         OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key))
     LIMIT 1;
  END IF;

  email_matches := email_key IS NOT NULL AND lower(nullif(btrim(candidate.email), '')) = email_key;
  phone_matches := phone_key IS NOT NULL AND public.growdash_normalize_phone(candidate.phone) = phone_key;
  NEW.meta_lead_id := candidate.meta_lead_id;
  NEW.meta_form_id := coalesce(candidate.form_id, NEW.meta_form_id);
  NEW.meta_campaign_id := coalesce(candidate.campaign_id, NEW.meta_campaign_id);
  NEW.meta_adset_id := coalesce(candidate.adset_id, NEW.meta_adset_id);
  NEW.meta_ad_id := coalesce(candidate.ad_id, NEW.meta_ad_id);
  NEW.meta_attribution_method := CASE
    WHEN NOT exact_account_match THEN 'meta_form_identifier_fallback'
    WHEN email_matches AND phone_matches THEN 'meta_form_email_phone_exact'
    WHEN email_matches THEN 'meta_form_email_exact'
    WHEN phone_matches THEN 'meta_form_phone_exact'
    ELSE NULL END;
  NEW.meta_attributed_at := now();
  NEW.meta_campaign_name := coalesce(candidate.campaign_name, NEW.meta_campaign_name);
  NEW.meta_adset_name := coalesce(candidate.adset_name, NEW.meta_adset_name);
  NEW.meta_ad_name := coalesce(candidate.ad_name, NEW.meta_ad_name);
  NEW.meta_form_name := coalesce(candidate.form_name, NEW.meta_form_name);
  NEW.meta_platform := coalesce(candidate.platform, NEW.meta_platform);
  NEW.meta_placement := coalesce(candidate.placement, NEW.meta_placement);
  NEW.meta_is_organic := coalesce(candidate.is_organic, NEW.meta_is_organic);
  NEW.meta_attribution_status := CASE
    WHEN NEW.meta_campaign_id IS NOT NULL AND NEW.meta_adset_id IS NOT NULL AND NEW.meta_ad_id IS NOT NULL
      AND NEW.meta_form_id IS NOT NULL
      AND nullif(btrim(NEW.meta_campaign_name), '') IS NOT NULL
      AND nullif(btrim(NEW.meta_adset_name), '') IS NOT NULL
      AND nullif(btrim(NEW.meta_ad_name), '') IS NOT NULL
      AND nullif(btrim(NEW.meta_form_name), '') IS NOT NULL
      AND nullif(btrim(NEW.meta_platform), '') IS NOT NULL
      AND nullif(btrim(NEW.meta_placement), '') IS NOT NULL THEN 'exact'
    ELSE 'partial'
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.link_rd_deal_to_meta_form_lead() FROM PUBLIC;
