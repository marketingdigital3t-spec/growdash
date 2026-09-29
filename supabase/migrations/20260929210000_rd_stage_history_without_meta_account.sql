-- RD funnels are valid without a Meta ad-account link. Keep stage history
-- for those funnels instead of failing the deal upsert on a NOT NULL UUID.
ALTER TABLE public.rd_deal_stage_history
  ALTER COLUMN ad_account_id DROP NOT NULL;

