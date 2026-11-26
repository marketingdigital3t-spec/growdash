-- Canonical Meta facts retain the attribution context used by Ads Manager.
-- Existing history is preserved and account_default is the explicit legacy
-- value for rows written before this contract existed.
ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS attribution_window text NOT NULL DEFAULT 'account_default',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS optimization_goal text,
  ADD COLUMN IF NOT EXISTS result_type text,
  ADD COLUMN IF NOT EXISTS result_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS form_leads numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS site_leads numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversations numeric NOT NULL DEFAULT 0;

ALTER TABLE public.insights
  DROP CONSTRAINT IF EXISTS insights_ad_id_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS insights_ad_date_attribution_uidx
  ON public.insights (ad_id, date, attribution_window);

COMMENT ON COLUMN public.insights.result_value IS
  'Official Meta Ads Manager result for the campaign objective; never a sum of unrelated events.';

ALTER TABLE public.insight_actions
  ADD COLUMN IF NOT EXISTS attribution_window text NOT NULL DEFAULT 'account_default',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'account';

ALTER TABLE public.insight_actions
  DROP CONSTRAINT IF EXISTS insight_actions_pkey;

ALTER TABLE public.insight_actions
  ADD CONSTRAINT insight_actions_pkey PRIMARY KEY (ad_id, date, action_type, attribution_window);
