-- Preserve the complete Meta attribution contract when an external CRM or
-- conversation connector forwards a lead into the first-party inbox.
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS meta_lead_id text,
  ADD COLUMN IF NOT EXISTS form_id text,
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS form_name text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS placement text,
  ADD COLUMN IF NOT EXISTS is_organic boolean;

CREATE INDEX IF NOT EXISTS crm_leads_workspace_meta_attribution_idx
  ON public.crm_leads (workspace_id, campaign_name, platform, placement, first_received_at DESC);

COMMENT ON COLUMN public.crm_leads.placement IS
  'Meta delivery placement when the provider supplies it (feed, story, reels, etc.).';
COMMENT ON COLUMN public.crm_leads.platform IS
  'Meta publisher platform when the provider supplies it (fb, ig, messenger, etc.).';

-- RD imports historically arrived without a Meta-account mapping. Keep the
-- strict account match when present, while allowing an unassigned RD deal to
-- receive a deterministic lead attribution by its e-mail/phone identifier.
CREATE OR REPLACE FUNCTION public.copy_meta_lead_attribution_to_rd_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_key text := lower(nullif(btrim(NEW.email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.phone);
BEGIN
  IF NEW.ad_account_id IS NULL OR (email_key IS NULL AND phone_key IS NULL) THEN
    RETURN NEW;
  END IF;

  UPDATE public.rd_deals d
     SET meta_lead_id = coalesce(NEW.meta_lead_id, d.meta_lead_id),
         meta_form_id = coalesce(NEW.form_id, d.meta_form_id),
         meta_campaign_id = coalesce(NEW.campaign_id, d.meta_campaign_id),
         meta_adset_id = coalesce(NEW.adset_id, d.meta_adset_id),
         meta_ad_id = coalesce(NEW.ad_id, d.meta_ad_id),
         meta_attribution_method = CASE
           WHEN d.ad_account_id IS NULL THEN 'meta_form_identifier_fallback'
           WHEN email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key
             AND phone_key IS NOT NULL AND public.growdash_normalize_phone(d.contact_phone) = phone_key
             THEN 'meta_form_email_phone_exact'
           WHEN email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key
             THEN 'meta_form_email_exact'
           ELSE 'meta_form_phone_exact'
         END,
         meta_attributed_at = now(),
         meta_campaign_name = coalesce(NEW.campaign_name, d.meta_campaign_name),
         meta_adset_name = coalesce(NEW.adset_name, d.meta_adset_name),
         meta_ad_name = coalesce(NEW.ad_name, d.meta_ad_name),
         meta_form_name = coalesce(NEW.form_name, d.meta_form_name),
         meta_platform = coalesce(NEW.platform, d.meta_platform),
         meta_placement = coalesce(NEW.placement, d.meta_placement),
         meta_is_organic = coalesce(NEW.is_organic, d.meta_is_organic),
         meta_attribution_status = CASE
           WHEN coalesce(NEW.campaign_id, d.meta_campaign_id) IS NOT NULL
             AND coalesce(NEW.adset_id, d.meta_adset_id) IS NOT NULL
             AND coalesce(NEW.ad_id, d.meta_ad_id) IS NOT NULL
             AND coalesce(NEW.form_id, d.meta_form_id) IS NOT NULL
             AND nullif(btrim(coalesce(NEW.campaign_name, d.meta_campaign_name)), '') IS NOT NULL
             AND nullif(btrim(coalesce(NEW.adset_name, d.meta_adset_name)), '') IS NOT NULL
             AND nullif(btrim(coalesce(NEW.ad_name, d.meta_ad_name)), '') IS NOT NULL
             AND nullif(btrim(coalesce(NEW.form_name, d.meta_form_name)), '') IS NOT NULL
             AND nullif(btrim(coalesce(NEW.platform, d.meta_platform)), '') IS NOT NULL
             AND nullif(btrim(coalesce(NEW.placement, d.meta_placement)), '') IS NOT NULL
             THEN 'exact'
           WHEN coalesce(NEW.campaign_id, d.meta_campaign_id) IS NOT NULL
             OR coalesce(NEW.adset_id, d.meta_adset_id) IS NOT NULL
             OR coalesce(NEW.ad_id, d.meta_ad_id) IS NOT NULL
             OR coalesce(NEW.form_id, d.meta_form_id) IS NOT NULL
             OR coalesce(NEW.campaign_name, d.meta_campaign_name) IS NOT NULL
             OR coalesce(NEW.adset_name, d.meta_adset_name) IS NOT NULL
             OR coalesce(NEW.ad_name, d.meta_ad_name) IS NOT NULL
             OR coalesce(NEW.form_name, d.meta_form_name) IS NOT NULL
             OR coalesce(NEW.platform, d.meta_platform) IS NOT NULL
             OR coalesce(NEW.placement, d.meta_placement) IS NOT NULL
             THEN 'partial'
           ELSE 'unavailable'
         END,
         updated_at = now()
   WHERE (d.ad_account_id = NEW.ad_account_id OR d.ad_account_id IS NULL)
     AND ((email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key)
       OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(d.contact_phone) = phone_key))
     AND coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) >= NEW.created_time - interval '180 days'
     AND coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) >= NEW.created_time;

  RETURN NEW;
END;
$$;

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
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.ad_account_id IS NOT DISTINCT FROM OLD.ad_account_id
    AND NEW.contact_email IS NOT DISTINCT FROM OLD.contact_email
    AND NEW.contact_phone IS NOT DISTINCT FROM OLD.contact_phone
    AND NEW.lead_created_at IS NOT DISTINCT FROM OLD.lead_created_at
  THEN
    RETURN NEW;
  END IF;

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

  IF email_key IS NULL AND phone_key IS NULL THEN
    RETURN NEW;
  END IF;

  reference_at := coalesce(NEW.lead_created_at, NEW.stage_updated_at, NEW.closed_at, now());

  -- Prefer the existing account-scoped contract whenever a funnel is linked.
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

  -- If RD has no Meta account mapping (or its mapping is stale), only use a
  -- workspace-level identifier fallback when exactly one Meta lead fits the
  -- contact and time window. This prevents cross-campaign guessing.
  IF NOT exact_account_match THEN
    SELECT count(*) INTO candidate_count
      FROM public.meta_leads m
     WHERE m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND ((email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key)
         OR (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key));
    IF candidate_count <> 1 THEN
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
  NEW.meta_form_id := candidate.form_id;
  NEW.meta_campaign_id := candidate.campaign_id;
  NEW.meta_adset_id := candidate.adset_id;
  NEW.meta_ad_id := candidate.ad_id;
  NEW.meta_attribution_method := CASE
    WHEN NOT exact_account_match THEN 'meta_form_identifier_fallback'
    WHEN email_matches AND phone_matches THEN 'meta_form_email_phone_exact'
    WHEN email_matches THEN 'meta_form_email_exact'
    WHEN phone_matches THEN 'meta_form_phone_exact'
    ELSE NULL END;
  NEW.meta_attributed_at := now();
  NEW.meta_campaign_name := candidate.campaign_name;
  NEW.meta_adset_name := candidate.adset_name;
  NEW.meta_ad_name := candidate.ad_name;
  NEW.meta_form_name := candidate.form_name;
  NEW.meta_platform := candidate.platform;
  NEW.meta_placement := candidate.placement;
  NEW.meta_is_organic := candidate.is_organic;
  NEW.meta_attribution_status := CASE
    WHEN candidate.campaign_id IS NOT NULL AND candidate.adset_id IS NOT NULL AND candidate.ad_id IS NOT NULL
      AND candidate.form_id IS NOT NULL
      AND nullif(btrim(candidate.campaign_name), '') IS NOT NULL
      AND nullif(btrim(candidate.adset_name), '') IS NOT NULL
      AND nullif(btrim(candidate.ad_name), '') IS NOT NULL
      AND nullif(btrim(candidate.form_name), '') IS NOT NULL
      AND nullif(btrim(candidate.platform), '') IS NOT NULL
      AND nullif(btrim(candidate.placement), '') IS NOT NULL THEN 'exact'
    ELSE 'partial'
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_meta_lead_attribution_to_rd_deal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_rd_deal_to_meta_form_lead() FROM PUBLIC;
