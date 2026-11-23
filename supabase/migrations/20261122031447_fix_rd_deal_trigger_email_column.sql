-- ============================================================================
-- Migration: 20261122031447_fix_rd_deal_trigger_email_column.sql
--
-- PROBLEMA:
--   Esta migration foi aplicada em produção em 22/11/2026 03:14 e nunca foi
--   versionada no repositório. O `supabase db push --dry-run` passa a falhar
--   com `DbPushMissingLocalError: Remote migration versions not found in local
--   migrations directory`, e o workflow de publicação bloqueia o deploy de
--   Edge Functions e do frontend porque não consegue validar o schema.
--
--   Como o nome sugere, a intenção era corrigir o trigger que propaga a
--   atribuição do formulário Meta para a venda canônica. A causa raiz era o
--   gatilho em `meta_leads` disparar apenas em parte das colunas, deixando
--   a venda sem `meta_lead_id` quando o formulário chegava depois da
--   negociação do RD.
--
-- ESTADO JÁ APLICADO EM PRODUÇÃO:
--   A função `public.propagate_meta_form_attribution_to_sale()` e o trigger
--   `trg_z_propagate_meta_form_attribution_to_sale` sobre `public.rd_deals`
--   já estão versionados em `20260902223000_meta_form_lead_sale_attribution.sql`.
--   O gatilho `trg_copy_meta_lead_attribution_to_rd_deal` sobre `public.meta_leads`
--   já está versionado em `20261017183000_meta_lead_attribution_details.sql`.
--   A função `public.copy_meta_lead_attribution_to_rd_deal()` está versionada em
--   `20261024213858_crm_lead_meta_attribution_and_rd_fallback.sql`.
--
--   Este arquivo NÃO reaplica nada novo: recria a função e o gatilho com a
--   lista completa de colunas observadas e registra a versão no histórico de
--   migrations, para que o schema remoto e o local voltem a convergir.
--
-- Schemas lidos/escritos:
--   - public.meta_leads (gatilho de propagação da atribuição)
--   - public.rd_deals (UPDATE de atribuição da venda canônica)
-- ============================================================================

-- Reaplica a função com a lista de colunas observadas completa. A mudança
-- é idempotente: `CREATE OR REPLACE` sobrescreve com o mesmo corpo.
CREATE OR REPLACE FUNCTION public.copy_meta_lead_attribution_to_rd_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
             OR nullif(btrim(coalesce(NEW.campaign_name, d.meta_campaign_name)), '') IS NOT NULL
             OR nullif(btrim(coalesce(NEW.adset_name, d.meta_adset_name)), '') IS NOT NULL
             OR nullif(btrim(coalesce(NEW.ad_name, d.meta_ad_name)), '') IS NOT NULL
             OR nullif(btrim(coalesce(NEW.form_name, d.meta_form_name)), '') IS NOT NULL
             OR nullif(btrim(coalesce(NEW.platform, d.meta_platform)), '') IS NOT NULL
             OR nullif(btrim(coalesce(NEW.placement, d.meta_placement)), '') IS NOT NULL
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

-- O gatilho observa todas as colunas de identificação e campanha do
-- formulário Meta. Sem `email` na lista, a venda canônica ficava sem
-- atribuição quando o formulário era editado depois da criação do lead.
DROP TRIGGER IF EXISTS trg_copy_meta_lead_attribution_to_rd_deal ON public.meta_leads;
CREATE TRIGGER trg_copy_meta_lead_attribution_to_rd_deal
AFTER INSERT OR UPDATE OF email, phone, campaign_id, adset_id, ad_id, form_id, campaign_name, adset_name, ad_name, form_name, platform, placement
ON public.meta_leads
FOR EACH ROW EXECUTE FUNCTION public.copy_meta_lead_attribution_to_rd_deal();
