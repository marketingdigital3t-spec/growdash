
-- 1) Raw actions per ad/day from Meta
CREATE TABLE public.insight_actions (
  ad_id text NOT NULL,
  date date NOT NULL,
  action_type text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  value_amount numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, date, action_type)
);

CREATE INDEX idx_insight_actions_action_type ON public.insight_actions(action_type);
CREATE INDEX idx_insight_actions_date ON public.insight_actions(date);

ALTER TABLE public.insight_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View insight_actions"
  ON public.insight_actions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_ad(auth.uid(), ad_id));

CREATE POLICY "Insert insight_actions"
  ON public.insight_actions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_ad(auth.uid(), ad_id));

CREATE POLICY "Update insight_actions"
  ON public.insight_actions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_ad(auth.uid(), ad_id));

CREATE POLICY "Delete insight_actions"
  ON public.insight_actions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_access_ad(auth.uid(), ad_id));

-- 2) Custom metrics defined by the user
CREATE TABLE public.custom_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('count','cost_per','rate')),
  numerator_action text,
  denominator_action text,
  denominator_field text,         -- 'spend' | 'impressions' | 'clicks' | NULL (when denominator is an action)
  format text NOT NULL DEFAULT 'number' CHECK (format IN ('number','currency','percent')),
  is_default_lead boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_metrics_user ON public.custom_metrics(user_id);

-- Only one default lead per user
CREATE UNIQUE INDEX uniq_custom_metrics_default_lead
  ON public.custom_metrics(user_id) WHERE is_default_lead;

ALTER TABLE public.custom_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own custom_metrics"
  ON public.custom_metrics FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Insert own custom_metrics"
  ON public.custom_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Update own custom_metrics"
  ON public.custom_metrics FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Delete own custom_metrics"
  ON public.custom_metrics FOR DELETE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_custom_metrics_updated_at
  BEFORE UPDATE ON public.custom_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
