-- Provider identity is scoped to the RD connection, not the Growdash user.
ALTER TABLE public.rd_deals DROP CONSTRAINT IF EXISTS rd_deals_user_id_rd_deal_id_key;
DROP INDEX IF EXISTS public.rd_deals_user_id_rd_deal_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS rd_deals_connection_external_uidx
  ON public.rd_deals (rd_connection_id, rd_deal_id)
  WHERE rd_connection_id IS NOT NULL AND rd_deal_id IS NOT NULL;
