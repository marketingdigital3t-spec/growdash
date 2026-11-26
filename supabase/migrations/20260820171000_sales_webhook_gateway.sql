-- Gateway de vendas: conexões por plataforma ficam em integrations; eventos são
-- deduplicados antes de alcançar a receita canônica em sales.
CREATE TABLE IF NOT EXISTS public.sales_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider_event_id text NOT NULL,
  event_type text,
  payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE (integration_id, provider_event_id)
);

CREATE INDEX IF NOT EXISTS sales_webhook_events_integration_received_idx
  ON public.sales_webhook_events (integration_id, received_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS sales_source_record_provider_unique_idx
  ON public.sales (user_id, source_provider, source_record_id)
  WHERE source_provider IS NOT NULL AND source_record_id IS NOT NULL;

ALTER TABLE public.sales_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales_webhook_events FROM anon, authenticated;
GRANT ALL ON public.sales_webhook_events TO service_role;

COMMENT ON TABLE public.sales_webhook_events IS
  'Idempotency and operational metadata for sale-platform webhooks. Raw payloads and credentials are intentionally never persisted.';
