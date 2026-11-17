-- ============================================================================
-- Migration: 20261117_fix_rls_lead_report_share_rate_limits.sql
-- Ataque de segurança GRO-SEC-002 do plano de auditoria Growdash.
--
-- Este arquivo é executado pelo usuário no SQL Editor do Supabase
-- (https://app.supabase.com → projeto Growdash → SQL Editor).
--
-- Não existe nenhuma migration anterior que habilite RLS nesta tabela.
-- Schemas lidos/escritos: public.lead_report_share_rate_limits (tabela existente).
--
-- Problema (GRO-SEC-002): a tabela lead_report_share_rate_limits não tem RLS
-- habilitado, permitindo que atacantes com a anon key leiam/escrevam (DELETE)
-- os contadores, zerem o limite de tentativas de links compartilhados e
-- enumerem relatórios existentes.
--
-- Instrução verbatim do usuário: "vamos corrigir tudo montando um prompt para
-- atacar um por 1"
-- ============================================================================

-- Habilita RLS na tabela (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'lead_report_share_rate_limits'
      AND c.relrowsecurity
  ) THEN
    EXECUTE 'ALTER TABLE public.lead_report_share_rate_limits ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Revoga tudo para roles públicas (anon/authenticated não devem acessar diretamente).
DO $$
BEGIN
  EXECUTE 'REVOKE ALL ON public.lead_report_share_rate_limits FROM anon, authenticated';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Concede acesso apenas ao service_role (backend).
DO $$
BEGIN
  EXECUTE 'GRANT ALL ON public.lead_report_share_rate_limits TO service_role';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Política RLS: service_role pode tudo; anon/authenticated não têm política (acesso negado).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lead_report_share_rate_limits'
      AND policyname = 'service_role_full_access'
  ) THEN
    EXECUTE 'CREATE POLICY service_role_full_access ON public.lead_report_share_rate_limits
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
