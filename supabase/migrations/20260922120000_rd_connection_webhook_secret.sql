ALTER TABLE public.rd_account_connections
  ADD COLUMN IF NOT EXISTS webhook_secret text;

CREATE UNIQUE INDEX IF NOT EXISTS rd_account_connections_webhook_secret_uidx
  ON public.rd_account_connections(webhook_secret)
  WHERE webhook_secret IS NOT NULL;
