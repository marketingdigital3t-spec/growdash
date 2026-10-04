-- Breakdown metrics must obey the same per-account attribution contract as daily Insights.
ALTER TABLE public.insights_breakdowns
  ADD COLUMN IF NOT EXISTS attribution_window text;

UPDATE public.insights_breakdowns AS breakdown
SET attribution_window = COALESCE(NULLIF(account.attribution_window, ''), 'account_default')
FROM public.campaigns AS campaign
JOIN public.ad_accounts AS account ON account.id = campaign.ad_account_id
WHERE campaign.id = breakdown.campaign_id
  AND breakdown.attribution_window IS NULL;

UPDATE public.insights_breakdowns
SET attribution_window = 'account_default'
WHERE attribution_window IS NULL;

ALTER TABLE public.insights_breakdowns
  ALTER COLUMN attribution_window SET DEFAULT 'account_default',
  ALTER COLUMN attribution_window SET NOT NULL;

ALTER TABLE public.insights_breakdowns
  DROP CONSTRAINT IF EXISTS insights_breakdowns_unique;

ALTER TABLE public.insights_breakdowns
  ADD CONSTRAINT insights_breakdowns_unique
    UNIQUE (campaign_id, date, breakdown_type, segment_key, attribution_window);

CREATE INDEX IF NOT EXISTS idx_insights_breakdowns_scope
  ON public.insights_breakdowns (campaign_id, attribution_window, breakdown_type, date);
