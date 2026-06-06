
CREATE TABLE public.rd_deal_touches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rd_deal_id text NOT NULL,
  ad_account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  touch_at timestamptz NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  matched_campaign_id text,
  touch_order integer NOT NULL DEFAULT 1,
  is_first boolean NOT NULL DEFAULT false,
  is_last boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rd_deal_touches_deal ON public.rd_deal_touches (rd_deal_id);
CREATE INDEX idx_rd_deal_touches_account_touch ON public.rd_deal_touches (ad_account_id, touch_at DESC);
CREATE INDEX idx_rd_deal_touches_campaign ON public.rd_deal_touches (matched_campaign_id);
CREATE UNIQUE INDEX uq_rd_deal_touches_dedup ON public.rd_deal_touches (rd_deal_id, touch_at, coalesce(utm_campaign,''), coalesce(utm_source,''), coalesce(utm_medium,''));

ALTER TABLE public.rd_deal_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rd_deal_touches" ON public.rd_deal_touches
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert rd_deal_touches" ON public.rd_deal_touches
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Update rd_deal_touches" ON public.rd_deal_touches
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete rd_deal_touches" ON public.rd_deal_touches
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

ALTER TABLE public.rd_deals
  ADD COLUMN IF NOT EXISTS first_touch_utm_campaign text,
  ADD COLUMN IF NOT EXISTS last_touch_utm_campaign text,
  ADD COLUMN IF NOT EXISTS touch_count integer NOT NULL DEFAULT 0;
