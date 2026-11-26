-- Atribuição por lead: nomes e origem retornados pela Meta no momento da
-- captura. Os IDs continuam sendo a chave canônica; os nomes são apenas um
-- snapshot para não depender de uma consulta posterior ao Graph API.
ALTER TABLE public.meta_leads
  ADD COLUMN IF NOT EXISTS campaign_name text,
  ADD COLUMN IF NOT EXISTS adset_name text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS form_name text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS placement text,
  ADD COLUMN IF NOT EXISTS is_organic boolean,
  ADD COLUMN IF NOT EXISTS attribution_status text NOT NULL DEFAULT 'captured';

ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS meta_campaign_name text,
  ADD COLUMN IF NOT EXISTS meta_adset_name text,
  ADD COLUMN IF NOT EXISTS meta_ad_name text,
  ADD COLUMN IF NOT EXISTS meta_form_name text,
  ADD COLUMN IF NOT EXISTS meta_platform text,
  ADD COLUMN IF NOT EXISTS meta_placement text,
  ADD COLUMN IF NOT EXISTS meta_is_organic boolean,
  ADD COLUMN IF NOT EXISTS meta_attribution_status text;

CREATE INDEX IF NOT EXISTS idx_meta_leads_account_identity
  ON public.meta_leads (ad_account_id, lower(email), created_time DESC);

CREATE INDEX IF NOT EXISTS idx_meta_leads_account_phone_identity
  ON public.meta_leads (ad_account_id, public.growdash_normalize_phone(phone), created_time DESC);

COMMENT ON COLUMN public.meta_leads.placement IS
  'Posicionamento individual somente quando a Meta o devolve no lead/site; null não significa feed.';
COMMENT ON COLUMN public.meta_leads.attribution_status IS
  'captured = lead recebido pela Meta; partial = IDs recebidos sem todos os nomes; unavailable = origem não identificável.';
COMMENT ON COLUMN public.rd_deals.meta_attribution_status IS
  'exact = vínculo por e-mail/telefone; partial = IDs/UTMs sem vínculo individual completo; unavailable = sem correspondência confiável.';

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
     SET meta_lead_id = NEW.meta_lead_id,
         meta_form_id = NEW.form_id,
         meta_campaign_id = NEW.campaign_id,
         meta_adset_id = NEW.adset_id,
         meta_ad_id = NEW.ad_id,
         meta_attribution_method = CASE
           WHEN email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key
             AND phone_key IS NOT NULL AND public.growdash_normalize_phone(d.contact_phone) = phone_key
             THEN 'meta_form_email_phone_exact'
           WHEN email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key
             THEN 'meta_form_email_exact'
           ELSE 'meta_form_phone_exact'
         END,
         meta_attributed_at = now(),
         meta_campaign_name = NEW.campaign_name,
         meta_adset_name = NEW.adset_name,
         meta_ad_name = NEW.ad_name,
         meta_form_name = NEW.form_name,
         meta_platform = NEW.platform,
         meta_placement = NEW.placement,
         meta_is_organic = NEW.is_organic,
         meta_attribution_status = CASE
           WHEN NEW.campaign_id IS NOT NULL AND NEW.adset_id IS NOT NULL AND NEW.ad_id IS NOT NULL THEN 'exact'
           ELSE 'partial'
         END,
         updated_at = now()
   WHERE d.ad_account_id = NEW.ad_account_id
     AND (email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key
       OR phone_key IS NOT NULL AND public.growdash_normalize_phone(d.contact_phone) = phone_key)
     AND coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) >= NEW.created_time - interval '180 days'
     AND coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) >= NEW.created_time;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_meta_lead_attribution_to_rd_deal ON public.meta_leads;
CREATE TRIGGER trg_copy_meta_lead_attribution_to_rd_deal
AFTER INSERT OR UPDATE OF email, phone, campaign_id, adset_id, ad_id, form_id, campaign_name, adset_name, ad_name, form_name, platform, placement
ON public.meta_leads
FOR EACH ROW EXECUTE FUNCTION public.copy_meta_lead_attribution_to_rd_deal();

-- These helpers are trigger-only SECURITY DEFINER functions. They must not
-- become callable RPCs through the exposed public schema.
REVOKE ALL ON FUNCTION public.copy_meta_lead_attribution_to_rd_deal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_rd_deal_to_meta_form_lead() FROM PUBLIC;

-- The reverse direction covers the common ordering where RD creates the deal
-- before the Meta webhook arrives. It keeps the existing exact-match contract
-- and never guesses by name, campaign or time alone.
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

  IF NEW.ad_account_id IS NULL OR (email_key IS NULL AND phone_key IS NULL) THEN
    RETURN NEW;
  END IF;

  reference_at := coalesce(NEW.lead_created_at, NEW.stage_updated_at, NEW.closed_at, now());
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
  IF NOT FOUND THEN RETURN NEW; END IF;

  email_matches := email_key IS NOT NULL AND lower(nullif(btrim(candidate.email), '')) = email_key;
  phone_matches := phone_key IS NOT NULL AND public.growdash_normalize_phone(candidate.phone) = phone_key;
  NEW.meta_lead_id := candidate.meta_lead_id;
  NEW.meta_form_id := candidate.form_id;
  NEW.meta_campaign_id := candidate.campaign_id;
  NEW.meta_adset_id := candidate.adset_id;
  NEW.meta_ad_id := candidate.ad_id;
  NEW.meta_attribution_method := CASE
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
    WHEN candidate.campaign_id IS NOT NULL AND candidate.adset_id IS NOT NULL AND candidate.ad_id IS NOT NULL THEN 'exact'
    ELSE 'partial' END;
  RETURN NEW;
END;
$$;
