-- Durable handoff for Meta/RD events that cannot be completed in the request.
-- The outbox is service-role only; the dead-letter table exposes only redacted
-- metadata to workspace members so a retry never depends on a browser session.
CREATE TABLE IF NOT EXISTS public.sync_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta', 'meta_leads', 'rd')),
  account_id text,
  object_id text,
  event_id text,
  scope_key text NOT NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload_sha256 text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS sync_event_outbox_pending_idx
  ON public.sync_event_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS public.sync_event_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta', 'meta_leads', 'rd')),
  account_id text,
  object_id text,
  event_id text,
  scope_key text NOT NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'replayed', 'discarded')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_code text NOT NULL,
  error_message text NOT NULL,
  first_failed_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS sync_event_dead_letters_status_idx
  ON public.sync_event_dead_letters (status, last_failed_at DESC);

ALTER TABLE public.sync_event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_event_dead_letters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sync_event_outbox, public.sync_event_dead_letters FROM PUBLIC, anon;
GRANT ALL ON public.sync_event_outbox TO service_role;
GRANT ALL ON public.sync_event_dead_letters TO service_role;
GRANT SELECT ON public.sync_event_dead_letters TO authenticated;

DROP POLICY IF EXISTS "Members view own sync dead letters" ON public.sync_event_dead_letters;
CREATE POLICY "Members view own sync dead letters"
  ON public.sync_event_dead_letters FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR public.is_workspace_member(workspace_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'master'::app_role)
  );

COMMENT ON TABLE public.sync_event_outbox IS
  'Service-role durable queue for Meta/RD events awaiting retry or CRM readback. Payload is never exposed to clients.';
COMMENT ON TABLE public.sync_event_dead_letters IS
  'Redacted audit of events that exceeded retry budget. No raw provider payload or token is stored.';
