-- ============================================================================
-- Migration: 20261122120000_fix_rd_deal_trigger_email_column.sql
--
-- PROBLEMA:
--   O trigger `trg_copy_meta_form_answers_to_rd_deal` roda BEFORE INSERT OR
--   UPDATE sobre `public.rd_deals`, mas a funcao
--   `public.copy_meta_form_answers_to_rd_deal()` foi copiada da trigger
--   equivalente de `public.meta_leads` sem adaptar os nomes das colunas.
--   Ela referencia `NEW.email` e `NEW.phone`, que existem em `meta_leads`,
--   mas em `rd_deals` as colunas se chamam `contact_email` e `contact_phone`.
--
--   Em PostgreSQL, `NEW.email` em uma tabela sem essa coluna e um erro em
--   tempo de execucao ("record \"new\" has no field \"email\"), nao um erro de
--   compilacao. A excecao aborta a transacao inteira do upsert, e o
--   PostgREST responde HTTP 400 em
--   POST /rest/v1/rd_deals?on_conflict=rd_connection_id,rd_deal_id.
--   O cliente Supabase JS reporta isso como
--   "Edge Function returned a non-2xx status code".
--
--   Evidencia de producao (2026-11-22):
--     postgres_logs: record "new" has no field "email"  (03:00:44 e 03:00:52)
--     edge_logs:    POST | 400 | .../rest/v1/rd_deals?on_conflict=...
--
--   Como o trigger sempre falhava, nenhuma resposta de questionario Meta
--   foi copiada para os negocios do RD: `lead_situacao_profissional`,
--   `lead_especialidade`, `lead_faturamento`, `lead_urgencia` e
--   `lead_objetivo` estao vazios em todos os 9.840 negocios.
--
-- CORRECAO:
--   1) Recria a funcao usando `NEW.contact_email` / `NEW.contact_phone`.
--   2) Preserva a intencao original: buscar o lead Meta mais proximo no
--      timeframe do negocio e copiar as respostas do questionario.
--   3) Mantem os REVOKE/GRANT de execucao ja aplicados na migration
--      original (a funcao continua sendo executada apenas por trigger).
--   4) Recria o trigger apontando para a funcao corrigida.
--
--   A migration e idempotente e usa blocos defensivos, conforme AGENTS.md.
-- ============================================================================

-- Remove o trigger atual. A funcao sera recriada com os nomes de coluna
-- corretos e o trigger sera religado em seguida.
DROP TRIGGER IF EXISTS trg_copy_meta_form_answers_to_rd_deal ON public.rd_deals;

CREATE OR REPLACE FUNCTION public.copy_meta_form_answers_to_rd_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- `rd_deals` stores the contact as contact_email/contact_phone. The original
  -- function read `NEW.email`/`NEW.phone`, which only exist on `meta_leads`
  -- and made every upsert fail with "record \"new\" has no field \"email\"".
  email_key text := lower(nullif(btrim(NEW.contact_email), ''));
  phone_key text := public.growdash_normalize_phone(NEW.contact_phone);
  candidate public.meta_leads%ROWTYPE;
  reference_at timestamptz;
BEGIN
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

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.lead_situacao_profissional := coalesce(candidate.lead_situacao_profissional, NEW.lead_situacao_profissional);
  NEW.lead_especialidade := coalesce(candidate.lead_especialidade, NEW.lead_especialidade);
  NEW.lead_faturamento := coalesce(candidate.lead_faturamento, NEW.lead_faturamento);
  NEW.lead_urgencia := coalesce(candidate.lead_urgencia, NEW.lead_urgencia);
  NEW.lead_objetivo := coalesce(candidate.lead_objetivo, NEW.lead_objetivo);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_copy_meta_form_answers_to_rd_deal
BEFORE INSERT OR UPDATE OF ad_account_id, contact_email, contact_phone, lead_created_at
ON public.rd_deals
FOR EACH ROW
EXECUTE FUNCTION public.copy_meta_form_answers_to_rd_deal();

-- A funcao e executada apenas por trigger. Preserva as restricoes aplicadas
-- na migration 20261118090000_meta_form_answers_to_rd_deal.sql.
REVOKE ALL ON FUNCTION public.copy_meta_form_answers_to_rd_deal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_meta_form_answers_to_rd_deal() TO service_role;
