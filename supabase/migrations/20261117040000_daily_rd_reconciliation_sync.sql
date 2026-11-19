-- ============================================================================
-- Migration: 20261117040000_daily_rd_reconciliation_sync.sql
--
-- Chamadas:
--   - supabase/functions/daily-reconciliation/index.ts  (expõe o endpoint)
--   - src/components/data-health/JobRunsCard.tsx        (botão "Executar agora")
-- Schemas lidos/escritos:
--   - public.daily_incremental_sync_runs  (tabela existente, criada nesta migração)
--   - public.rd_funnels                   (tabela existente, consulta em rd-sync-deals)
--   - private.daily_incremental_sync_config  (tabela existente, criada nesta migração)
--   - public.functions.verify_daily_incremental_sync_secret(text) (função existente)
--
-- Instrução verbatim do usuário: "vamos corrigir tudo montando um prompt para
-- atacar um por 1"
-- ============================================================================

-- Extensões necessárias pelo pg_cron e pg_net (idempotentes).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Tabela de configuração do job (idêntica ao padrão existente em
-- 20260723030000_daily_previous_day_incremental_sync.sql).
CREATE TABLE IF NOT EXISTS private.daily_incremental_sync_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  cron_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.daily_incremental_sync_config (singleton, cron_secret)
VALUES (true, encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (singleton) DO NOTHING;

REVOKE ALL ON TABLE private.daily_incremental_sync_config
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.daily_incremental_sync_config TO service_role;

-- Função auxiliar para validar o segredo do cron (idêntica ao padrão existente
-- em 20260723030000_daily_previous_day_incremental_sync.sql).
CREATE OR REPLACE FUNCTION public.verify_daily_incremental_sync_secret(candidate text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, private
AS $$
  SELECT candidate IS NOT NULL
    AND candidate = (
      SELECT cron_secret
      FROM private.daily_incremental_sync_config
      WHERE singleton = true
    );
$$;

REVOKE ALL ON FUNCTION public.verify_daily_incremental_sync_secret(text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_daily_incremental_sync_secret(text)
TO service_role;

-- Agenda (ou re-agenda, se já existir) o job diário às 07:00 UTC (04:00 BRT).
-- O nome do job é único; se já existir, remove e recria, garantindo idempotência.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'growdash-daily-reconciliation'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

-- O RD Station executa às 04:00 BRT (07:00 UTC). O cron roda em UTC.
SELECT cron.schedule(
  'growdash-daily-reconciliation',
  '0 7 * * *',
  $$cron$
    SELECT net.http_post(
      url := 'https://cixnvosxqlacjbpymjha.supabase.co/functions/v1/daily-reconciliation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true),
        'apikey', (SELECT cron_secret FROM private.daily_incremental_sync_config WHERE singleton = true)
      ),
      body := jsonb_build_object(
        'trigger', 'pg_cron',
        'requested_at', now()
      )
    );
  $cron$
);
