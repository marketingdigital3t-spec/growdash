
-- 1. Add columns to rd_deals to track real RD stage info
ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS rd_stage_order integer,
  ADD COLUMN IF NOT EXISTS deal_owner_name text,
  ADD COLUMN IF NOT EXISTS rd_product_name text;

CREATE INDEX IF NOT EXISTS idx_rd_deals_funnel_stage ON public.rd_deals(rd_funnel_id, rd_stage_order);

-- 2. Create rd_funnel_stages: cached list of stages per funnel, in real RD order
CREATE TABLE IF NOT EXISTS public.rd_funnel_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_funnel_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rd_stage_id text NOT NULL,
  name text NOT NULL,
  nickname text,
  "order" integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (rd_funnel_id, rd_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_rd_funnel_stages_funnel ON public.rd_funnel_stages(rd_funnel_id, "order");

ALTER TABLE public.rd_funnel_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rd_funnel_stages"
ON public.rd_funnel_stages FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert rd_funnel_stages"
ON public.rd_funnel_stages FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Update rd_funnel_stages"
ON public.rd_funnel_stages FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete rd_funnel_stages"
ON public.rd_funnel_stages FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
