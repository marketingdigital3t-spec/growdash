-- RD credentials are server-only. The browser may see operational status,
-- but tokens and webhook secrets are only available to Edge Functions.
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  provider,
  is_active,
  created_at,
  updated_at
) ON TABLE public.integrations TO authenticated;

GRANT INSERT (
  user_id,
  provider,
  is_active
) ON TABLE public.integrations TO authenticated;

GRANT UPDATE (
  is_active
) ON TABLE public.integrations TO authenticated;

GRANT DELETE ON TABLE public.integrations TO authenticated;
GRANT ALL ON TABLE public.integrations TO service_role;

COMMENT ON COLUMN public.integrations.api_token IS
  'Server-only provider credential. Never expose through authenticated/anon grants.';

COMMENT ON COLUMN public.integrations.webhook_secret IS
  'Server-only webhook credential. Never expose through authenticated/anon grants.';
