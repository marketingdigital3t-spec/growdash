-- Persist the provider-reported Meta token lifecycle so OAuth refreshes are
-- observable and tokens with an unexpectedly short lifetime are not accepted
-- silently.
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_refresh_source text;

COMMENT ON COLUMN public.ad_accounts.token_expires_at IS
  'Expiration reported by Meta debug_token; NULL means the provider did not expose an expiry.';
COMMENT ON COLUMN public.ad_accounts.token_refresh_source IS
  'Origin of the credential: oauth, manual, or health_check.';

CREATE INDEX IF NOT EXISTS ad_accounts_token_expiry_idx
  ON public.ad_accounts (token_expires_at)
  WHERE token_expires_at IS NOT NULL;
