-- One-time, server-only OAuth state used to bind a Meta callback to the
-- authenticated Growdash user who started the connection.
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meta_oauth_states FROM anon, authenticated;
GRANT ALL ON TABLE public.meta_oauth_states TO service_role;

CREATE INDEX IF NOT EXISTS meta_oauth_states_expires_at_idx
  ON public.meta_oauth_states (expires_at);

COMMENT ON TABLE public.meta_oauth_states IS
  'Server-only, single-use CSRF state for the Meta OAuth callback.';
