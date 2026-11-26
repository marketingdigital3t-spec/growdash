-- Credenciais de terceiros não podem ser lidas pelo navegador.
-- public.integrations guarda client_secret, access_token, refresh_token e
-- oauth_state e tinha GRANT de tabela inteira para authenticated
-- (20260606151252), sem o REVOKE por coluna aplicado em ad_accounts
-- (20260714134000) e whatsapp_numbers (20260930183000). Este migration
-- replica aquele padrão: as colunas operacionais continuam legíveis pelas
-- policies e pelos grants por coluna; as de credencial passam a ser
-- acessíveis apenas a service_role, dentro das Edge Functions.

-- Revoga SELECT em colunas sensíveis apenas quando existirem na tabela,
-- suportando instâncias onde tokens OAuth residem em tabelas dedicadas.
DO $$
DECLARE
  col text;
  sensitive_cols text[] := ARRAY['access_token', 'refresh_token', 'client_secret', 'oauth_state', 'api_token', 'webhook_secret'];
BEGIN
  FOREACH col IN ARRAY sensitive_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integrations' AND column_name = col
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON public.integrations FROM anon, authenticated', col);
      EXECUTE format('GRANT SELECT (%I) ON public.integrations TO service_role', col);
      EXECUTE format('COMMENT ON COLUMN public.integrations.%I IS %L', col, 'Server-only credential. Never expose through authenticated/anon SELECT grants.');
    END IF;
  END LOOP;
END $$;
