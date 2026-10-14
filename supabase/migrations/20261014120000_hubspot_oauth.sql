-- HubSpot OAuth state is single-use and expires quickly. Tokens remain in the
-- protected integrations table; only connection health is exposed to clients.
CREATE TABLE IF NOT EXISTS public.hubspot_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hubspot_oauth_states_expiry_idx ON public.hubspot_oauth_states(expires_at);
ALTER TABLE public.hubspot_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hubspot_oauth_states FROM anon, authenticated;
GRANT ALL ON public.hubspot_oauth_states TO service_role;
