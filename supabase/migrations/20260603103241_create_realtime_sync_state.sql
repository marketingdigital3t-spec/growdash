CREATE TABLE IF NOT EXISTS public.realtime_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  scope_key text NOT NULL,
  status text NOT NULL DEFAULT 'idle',
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider, scope_key)
);

ALTER TABLE public.realtime_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own realtime sync state"
ON public.realtime_sync_state
FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Only service role writes realtime sync state"
ON public.realtime_sync_state
FOR ALL
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_realtime_sync_state_user_provider
ON public.realtime_sync_state (user_id, provider, scope_key);
