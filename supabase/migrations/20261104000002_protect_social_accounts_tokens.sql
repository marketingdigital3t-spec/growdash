-- H3: Credenciais de redes sociais não podem ser lidas pelo navegador nem por authenticated.
-- Replica o padrão de 20260714134000_protect_meta_access_tokens.sql e
-- 20260930183000_whatsapp_cloud_inbox.sql.
-- Adiciona a coluna se não existir e revoga explicitamente o SELECT para anon e authenticated,
-- garantindo acesso exclusivo de leitura de token para a service_role (Edge Functions).

ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS access_token text;

REVOKE SELECT (access_token)
  ON public.social_accounts FROM anon, authenticated;

GRANT SELECT (access_token)
  ON public.social_accounts TO service_role;

COMMENT ON COLUMN public.social_accounts.access_token IS
  'Server-only social OAuth token. Never expose through authenticated/anon SELECT grants.';
