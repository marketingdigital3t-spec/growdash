-- Credenciais de terceiros não podem ser lidas pelo navegador.
-- public.integrations guarda client_secret, access_token, refresh_token e
-- oauth_state e tinha GRANT de tabela inteira para authenticated
-- (20260606151252), sem o REVOKE por coluna aplicado em ad_accounts
-- (20260714134000) e whatsapp_numbers (20260930183000). Este migration
-- replica aquele padrão: as colunas operacionais continuam legíveis pelas
-- policies e pelos grants por coluna; as de credencial passam a ser
-- acessíveis apenas a service_role, dentro das Edge Functions.

REVOKE SELECT (access_token, refresh_token, client_secret, oauth_state, api_token, webhook_secret)
  ON public.integrations FROM anon, authenticated;

GRANT SELECT (access_token, refresh_token, client_secret, oauth_state, api_token, webhook_secret)
  ON public.integrations TO service_role;

COMMENT ON COLUMN public.integrations.access_token IS
  'Server-only OAuth token. Never expose through authenticated/anon SELECT grants.';
COMMENT ON COLUMN public.integrations.refresh_token IS
  'Server-only OAuth refresh token. Never expose through authenticated/anon SELECT grants.';
COMMENT ON COLUMN public.integrations.client_secret IS
  'Server-only OAuth client secret. Never expose through authenticated/anon SELECT grants.';
COMMENT ON COLUMN public.integrations.oauth_state IS
  'Server-only OAuth state. Never expose through authenticated/anon SELECT grants.';
