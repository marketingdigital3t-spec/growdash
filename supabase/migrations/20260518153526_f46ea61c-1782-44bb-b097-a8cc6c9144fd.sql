
CREATE TABLE public.rd_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  rd_funnel_id uuid NOT NULL,
  rd_deal_id text NOT NULL,
  rd_stage_id text,
  rd_stage_name text,
  stage_bucket text NOT NULL DEFAULT 'lead',
  win boolean NOT NULL DEFAULT false,
  lost_reason text,
  amount_total numeric DEFAULT 0,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  lead_state text,
  lead_city text,
  lead_created_at timestamptz,
  stage_updated_at timestamptz,
  closed_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rd_deal_id)
);

CREATE INDEX idx_rd_deals_funnel ON public.rd_deals (user_id, rd_funnel_id);
CREATE INDEX idx_rd_deals_bucket ON public.rd_deals (stage_bucket);
CREATE INDEX idx_rd_deals_lead_created ON public.rd_deals (lead_created_at);

ALTER TABLE public.rd_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rd_deals" ON public.rd_deals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert rd_deals" ON public.rd_deals FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Update rd_deals" ON public.rd_deals FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete rd_deals" ON public.rd_deals FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TRIGGER update_rd_deals_updated_at
BEFORE UPDATE ON public.rd_deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
