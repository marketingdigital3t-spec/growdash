
CREATE TABLE public.insights_breakdowns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id text NOT NULL,
  date date NOT NULL,
  breakdown_type text NOT NULL,
  segment_key text NOT NULL,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  clicks bigint DEFAULT 0,
  leads integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insights_breakdowns_unique UNIQUE (campaign_id, date, breakdown_type, segment_key)
);

CREATE INDEX idx_insights_breakdowns_campaign ON public.insights_breakdowns (campaign_id, breakdown_type, date);

ALTER TABLE public.insights_breakdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View breakdowns" ON public.insights_breakdowns
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));

CREATE POLICY "Insert breakdowns" ON public.insights_breakdowns
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));

CREATE POLICY "Update breakdowns" ON public.insights_breakdowns
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));

CREATE POLICY "Delete breakdowns" ON public.insights_breakdowns
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
