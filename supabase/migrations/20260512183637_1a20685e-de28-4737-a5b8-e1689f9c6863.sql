-- rd_funnels table
CREATE TABLE public.rd_funnels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ad_account_id uuid NOT NULL,
  name text NOT NULL,
  expert_name text,
  rd_funnel_id text,
  utm_campaign_pattern text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rd_funnels_account ON public.rd_funnels(ad_account_id);
CREATE INDEX idx_rd_funnels_user ON public.rd_funnels(user_id);

ALTER TABLE public.rd_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View rd funnels" ON public.rd_funnels FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert rd funnels" ON public.rd_funnels FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR (auth.uid() = user_id AND user_owns_ad_account(auth.uid(), ad_account_id)));
CREATE POLICY "Update rd funnels" ON public.rd_funnels FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Delete rd funnels" ON public.rd_funnels FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TRIGGER update_rd_funnels_updated_at
  BEFORE UPDATE ON public.rd_funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- UTM and matching columns on sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS rd_funnel_id uuid,
  ADD COLUMN IF NOT EXISTS matched_campaign_id text,
  ADD COLUMN IF NOT EXISTS match_method text;

CREATE INDEX IF NOT EXISTS idx_sales_matched_campaign ON public.sales(matched_campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_rd_funnel ON public.sales(rd_funnel_id);