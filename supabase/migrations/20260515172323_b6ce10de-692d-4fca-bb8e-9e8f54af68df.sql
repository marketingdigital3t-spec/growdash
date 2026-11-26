
CREATE TABLE IF NOT EXISTS public.insights_hourly (
  ad_account_id uuid NOT NULL,
  campaign_id text,
  ad_id text NOT NULL,
  date date NOT NULL,
  hour smallint NOT NULL CHECK (hour >= 0 AND hour <= 23),
  leads numeric NOT NULL DEFAULT 0,
  clicks numeric NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_insights_hourly_account_date ON public.insights_hourly (ad_account_id, date);
CREATE INDEX IF NOT EXISTS idx_insights_hourly_campaign_date ON public.insights_hourly (campaign_id, date);

ALTER TABLE public.insights_hourly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View insights_hourly" ON public.insights_hourly
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert insights_hourly" ON public.insights_hourly
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Update insights_hourly" ON public.insights_hourly
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete insights_hourly" ON public.insights_hourly
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
