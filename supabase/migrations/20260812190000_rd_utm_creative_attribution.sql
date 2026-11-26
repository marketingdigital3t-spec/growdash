-- Preserve the native Meta ad ID passed in utm_id. Names may be edited or
-- duplicated; this identifier makes the RD → sale → creative match exact.
ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS utm_id text;

CREATE INDEX IF NOT EXISTS rd_deals_utm_id_idx
  ON public.rd_deals (ad_account_id, utm_id)
  WHERE utm_id IS NOT NULL;

COMMENT ON COLUMN public.rd_deals.utm_id IS
  'Native ad identifier received from RD UTM (utm_id). Used for exact Meta creative attribution.';

COMMENT ON COLUMN public.sales.ad_id IS
  'Native Meta ad identifier. When imported from RD it is populated from utm_id for exact creative attribution.';
