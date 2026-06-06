ALTER TABLE public.integrations
  DROP COLUMN IF EXISTS client_id,
  DROP COLUMN IF EXISTS client_secret,
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS token_expires_at,
  DROP COLUMN IF EXISTS oauth_state;