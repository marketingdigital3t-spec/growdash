
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS oauth_state text;
