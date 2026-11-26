ALTER TABLE public.rd_deal_note_sync
  ADD COLUMN IF NOT EXISTS rd_connection_id uuid REFERENCES public.rd_account_connections(id) ON DELETE CASCADE;

ALTER TABLE public.rd_deal_note_sync
  ALTER COLUMN integration_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rd_deal_note_sync_connection_deal_uidx
  ON public.rd_deal_note_sync (rd_connection_id, rd_deal_id)
  WHERE rd_connection_id IS NOT NULL;
