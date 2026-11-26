-- Fechamento de atribuição Meta Lead Ads -> RD Station -> venda.
--
-- O Meta fornece IDs imutáveis de campanha, conjunto e anúncio no envio do
-- formulário. O RD não recebe esses IDs de forma nativa, então o vínculo é
-- feito apenas dentro da mesma conta por e-mail e/ou telefone normalizados e
-- com o formulário anterior à criação da negociação. Nunca há match por nome.

ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS meta_lead_id text,
  ADD COLUMN IF NOT EXISTS meta_form_id text,
  ADD COLUMN IF NOT EXISTS meta_campaign_id text,
  ADD COLUMN IF NOT EXISTS meta_adset_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_id text,
  ADD COLUMN IF NOT EXISTS meta_attribution_method text,
  ADD COLUMN IF NOT EXISTS meta_attributed_at timestamptz;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS meta_lead_id text,
  ADD COLUMN IF NOT EXISTS meta_form_id text,
  ADD COLUMN IF NOT EXISTS meta_attribution_method text;

COMMENT ON COLUMN public.rd_deals.meta_lead_id IS
  'ID do envio nativo Meta Lead Ads associado por identificador de contato e janela temporal.';
COMMENT ON COLUMN public.rd_deals.meta_attribution_method IS
  'Método verificável de vínculo Meta Lead Ads: email_phone, email ou phone.';
COMMENT ON COLUMN public.sales.meta_lead_id IS
  'ID do formulário Meta que originou a venda, quando a identidade foi vinculada ao RD.';

CREATE OR REPLACE FUNCTION public.growdash_normalize_phone(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT nullif(regexp_replace(coalesce(_value, ''), '\\D', '', 'g'), '')
$$;

CREATE INDEX IF NOT EXISTS idx_meta_leads_account_email_created
  ON public.meta_leads (ad_account_id, lower(email), created_time DESC)
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_meta_leads_account_phone_created
  ON public.meta_leads (ad_account_id, public.growdash_normalize_phone(phone), created_time DESC)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

CREATE INDEX IF NOT EXISTS idx_rd_deals_meta_lead
  ON public.rd_deals (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_meta_lead
  ON public.sales (meta_lead_id)
  WHERE meta_lead_id IS NOT NULL;

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
  -- Do not rematch an unchanged negotiation during ordinary stage updates.
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

  IF NEW.ad_account_id IS NULL OR (email_key IS NULL AND phone_key IS NULL) THEN
    RETURN NEW;
  END IF;

  reference_at := coalesce(NEW.lead_created_at, NEW.stage_updated_at, NEW.closed_at, now());

  SELECT m.*
    INTO candidate
    FROM public.meta_leads m
   WHERE m.ad_account_id = NEW.ad_account_id
     -- The source form must precede the RD negotiation. The 180-day window
     -- avoids binding a historic contact submission to a new opportunity.
     AND m.created_time <= reference_at
     AND m.created_time >= reference_at - interval '180 days'
     AND (
       (email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key)
       OR
       (phone_key IS NOT NULL AND public.growdash_normalize_phone(m.phone) = phone_key)
     )
   ORDER BY
     CASE
       WHEN email_key IS NOT NULL
        AND phone_key IS NOT NULL
        AND lower(nullif(btrim(m.email), '')) = email_key
        AND public.growdash_normalize_phone(m.phone) = phone_key THEN 0
       WHEN email_key IS NOT NULL AND lower(nullif(btrim(m.email), '')) = email_key THEN 1
       ELSE 2
     END,
     m.created_time DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  email_matches := email_key IS NOT NULL
    AND lower(nullif(btrim(candidate.email), '')) = email_key;
  phone_matches := phone_key IS NOT NULL
    AND public.growdash_normalize_phone(candidate.phone) = phone_key;

  NEW.meta_lead_id := candidate.meta_lead_id;
  NEW.meta_form_id := candidate.form_id;
  NEW.meta_campaign_id := candidate.campaign_id;
  NEW.meta_adset_id := candidate.adset_id;
  NEW.meta_ad_id := candidate.ad_id;
  NEW.meta_attribution_method := CASE
    WHEN email_matches AND phone_matches THEN 'meta_form_email_phone_exact'
    WHEN email_matches THEN 'meta_form_email_exact'
    WHEN phone_matches THEN 'meta_form_phone_exact'
    ELSE NULL
  END;
  NEW.meta_attributed_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_rd_deal_to_meta_form_lead ON public.rd_deals;
CREATE TRIGGER trg_link_rd_deal_to_meta_form_lead
BEFORE INSERT OR UPDATE OF ad_account_id, contact_email, contact_phone, lead_created_at
ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.link_rd_deal_to_meta_form_lead();

CREATE OR REPLACE FUNCTION public.propagate_meta_form_attribution_to_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT coalesce(NEW.win, false) OR NEW.meta_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales s
     SET meta_lead_id = NEW.meta_lead_id,
         meta_form_id = NEW.meta_form_id,
         meta_attribution_method = NEW.meta_attribution_method,
         campaign_ids = CASE
           WHEN coalesce(s.manual_override, false) THEN s.campaign_ids
           WHEN NEW.meta_campaign_id IS NULL THEN s.campaign_ids
           ELSE ARRAY[NEW.meta_campaign_id]
         END,
         matched_campaign_id = CASE
           WHEN coalesce(s.manual_override, false) THEN s.matched_campaign_id
           ELSE coalesce(NEW.meta_campaign_id, s.matched_campaign_id)
         END,
         adset_id = CASE
           WHEN coalesce(s.manual_override, false) THEN s.adset_id
           ELSE coalesce(NEW.meta_adset_id, s.adset_id)
         END,
         ad_id = CASE
           WHEN coalesce(s.manual_override, false) THEN s.ad_id
           ELSE coalesce(NEW.meta_ad_id, s.ad_id)
         END,
         match_method = CASE
           WHEN coalesce(s.manual_override, false) THEN s.match_method
           ELSE coalesce(NEW.meta_attribution_method, s.match_method)
         END,
         attribution_confidence = CASE
           WHEN coalesce(s.manual_override, false) THEN s.attribution_confidence
           WHEN NEW.meta_attribution_method = 'meta_form_email_phone_exact' THEN 1.0000
           WHEN NEW.meta_attribution_method = 'meta_form_email_exact' THEN 0.9800
           WHEN NEW.meta_attribution_method = 'meta_form_phone_exact' THEN 0.9500
           ELSE s.attribution_confidence
         END,
         attribution_reason = CASE
           WHEN coalesce(s.manual_override, false) THEN s.attribution_reason
           ELSE coalesce(NEW.meta_attribution_method, s.attribution_reason)
         END,
         updated_at = now()
   WHERE s.rd_deal_id = NEW.rd_deal_id
     AND s.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_z_propagate_meta_form_attribution_to_sale ON public.rd_deals;
CREATE TRIGGER trg_z_propagate_meta_form_attribution_to_sale
AFTER INSERT OR UPDATE ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.propagate_meta_form_attribution_to_sale();

-- Meta and RD are synchronized independently. When the Meta form arrives
-- after its RD deal, touch only matching candidate deals so the BEFORE trigger
-- above resolves the newest valid form with the same deterministic rules.
CREATE OR REPLACE FUNCTION public.reconcile_meta_form_lead_arrival()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_key text := lower(nullif(btrim(NEW.email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.phone);
BEGIN
  IF email_key IS NULL AND phone_key IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.rd_deals d
     SET contact_email = d.contact_email
   WHERE d.ad_account_id = NEW.ad_account_id
     AND coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) >= NEW.created_time
     AND coalesce(d.lead_created_at, d.stage_updated_at, d.closed_at, now()) <= NEW.created_time + interval '180 days'
     AND (
       (email_key IS NOT NULL AND lower(nullif(btrim(d.contact_email), '')) = email_key)
       OR
       (phone_key IS NOT NULL AND public.growdash_normalize_phone(d.contact_phone) = phone_key)
     );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_meta_form_lead_arrival ON public.meta_leads;
CREATE TRIGGER trg_reconcile_meta_form_lead_arrival
AFTER INSERT OR UPDATE OF email, phone, created_time, campaign_id, adset_id, ad_id, form_id
ON public.meta_leads
FOR EACH ROW EXECUTE FUNCTION public.reconcile_meta_form_lead_arrival();

-- Reprocess historical records once. This is idempotent and preserves manual
-- sales attribution because the sales propagation trigger explicitly respects
-- manual_override.
UPDATE public.rd_deals
   SET contact_email = contact_email
 WHERE contact_email IS NOT NULL OR contact_phone IS NOT NULL;
