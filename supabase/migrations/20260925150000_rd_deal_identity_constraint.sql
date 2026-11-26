-- PostgREST cannot infer a partial unique index for
-- onConflict=rd_connection_id,rd_deal_id. A regular unique constraint is
-- compatible with the existing upsert and still allows multiple legacy rows
-- where rd_connection_id is NULL.
DROP INDEX IF EXISTS public.rd_deals_connection_external_uidx;
ALTER TABLE public.rd_deals
  DROP CONSTRAINT IF EXISTS rd_deals_connection_external_key;
ALTER TABLE public.rd_deals
  ADD CONSTRAINT rd_deals_connection_external_key UNIQUE (rd_connection_id, rd_deal_id);
