-- ============================================================================
-- Migration: 20261124150000_fix_link_rd_deal_meta_lead_id_column.sql
--
-- PROBLEMA:
--   A funcao `public.link_rd_deal_to_meta_form_lead()` e um trigger BEFORE
--   INSERT OR UPDATE sobre `public.rd_deals`. Ela faz
--   `NEW.meta_lead_id := candidate.lead_id`, mas a tabela
--   `public.meta_leads` NAO tem a coluna `lead_id` — a coluna do id do
--   lead da Meta e `meta_lead_id`.
--
--   Em PostgreSQL, `candidate.lead_id` numa rowtype sem essa coluna e um
--   erro em tempo de execucao ("record \"candidate\" has no field
--   \"lead_id\""), nao um erro de compilacao. A excecao aborta a
--   transacao inteira do upsert do RD e o run de sync termina como
--   `failed`.
--
--   Evidencia de producao (2026-11-24), em `public.sync_runs`:
--     failed | record "candidate" has no field "lead_id"  | 1 run
--   O sync do RD fica com 24 falhas e 20 parciais, e a tela de Resumo
--   de Performance mostra que o ultimo snapshot foi preservado.
--
-- CAUSA:
--   A regressao veio de `20261113190000_optimize_rd_attribution_and_link_sister_accounts.sql`,
--   que trocou `candidate.meta_lead_id` por `candidate.lead_id`. As seis
--   migrations anteriores (17/06, 17/10 x2, 18/10 x2, 24/10, 13/11)
--   usavam a coluna correta.
--
-- CORRECAO:
--   Recriar a funcao com `candidate.meta_lead_id`. A funcao completa e
--   reimposta para nao deixar nenhum outro detalhe divergente, e o
--   restante do corpo (regras de busca por e-mail e telefone,
--   tolerancia de 180 dias, metodos de atribuicao) fica intacto.
--
--   `CREATE OR REPLACE` e idempotente: rodar de novo nao muda nada.
--
-- Schemas lidos/escritos:
--   - public.rd_deals (atribuicao Meta: meta_lead_id, meta_form_id,
--     meta_campaign_id, meta_adset_id, meta_ad_id, meta_attributed_at,
--     meta_attribution_method)
--   - public.meta_leads (leitura: email, phone, meta_lead_id, form_id,
--     campaign_id, adset_id, ad_id, created_time)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.link_rd_deal_to_meta_form_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  candidate public.meta_leads%ROWTYPE;
  reference_at timestamptz;
  email_key text := lower(nullif(btrim(NEW.contact_email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.contact_phone);
  email_matches boolean := false;
  phone_matches boolean := false;
BEGIN
  -- Nao reatribui negocio inalterado em atualizacoes normais de etapa
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

  -- PASSO 1: Busca ultra-rapida por E-MAIL (utiliza idx_meta_leads_account_email_created)
  IF email_key IS NOT NULL THEN
    SELECT m.*
      INTO candidate
      FROM public.meta_leads m
     WHERE m.ad_account_id = NEW.ad_account_id
       AND m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND lower(nullif(btrim(m.email), '')) = email_key
     ORDER BY m.created_time DESC
     LIMIT 1;
  END IF;

  -- PASSO 2: Se nao encontrou por e-mail, busca por TELEFONE (utiliza idx_meta_leads_account_phone_created)
  IF candidate.id IS NULL AND phone_key IS NOT NULL THEN
    SELECT m.*
      INTO candidate
      FROM public.meta_leads m
     WHERE m.ad_account_id = NEW.ad_account_id
       AND m.created_time <= reference_at
       AND m.created_time >= reference_at - interval '180 days'
       AND public.growdash_normalize_phone(m.phone) = phone_key
     ORDER BY m.created_time DESC
     LIMIT 1;
  END IF;

  IF candidate.id IS NULL THEN
    RETURN NEW;
  END IF;

  email_matches := email_key IS NOT NULL
    AND lower(nullif(btrim(candidate.email), '')) = email_key;
  phone_matches := phone_key IS NOT NULL
    AND public.growdash_normalize_phone(candidate.phone) = phone_key;

  -- A coluna do id do lead da Meta e `meta_lead_id`. A coluna `lead_id`
  -- nao existe em `public.meta_leads` e abortava o upsert do RD.
  NEW.meta_lead_id := candidate.meta_lead_id;
  NEW.meta_form_id := candidate.form_id;
  NEW.meta_campaign_id := candidate.campaign_id;
  NEW.meta_adset_id := candidate.adset_id;
  NEW.meta_ad_id := candidate.ad_id;
  NEW.meta_attributed_at := now();

  IF email_matches AND phone_matches THEN
    NEW.meta_attribution_method := 'meta_form_email_phone_exact';
  ELSIF email_matches THEN
    NEW.meta_attribution_method := 'meta_form_email_exact';
  ELSE
    NEW.meta_attribution_method := 'meta_form_phone_exact';
  END IF;

  RETURN NEW;
END;
$$;
