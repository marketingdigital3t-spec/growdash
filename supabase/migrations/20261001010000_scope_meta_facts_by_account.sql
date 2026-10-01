-- Keep the account scope on the facts themselves. The UI must not depend on
-- a complete campaign/ad catalog to display already persisted Meta metrics.
ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.insight_actions
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE;

UPDATE public.insights i
SET ad_account_id = c.ad_account_id
FROM public.ads a
JOIN public.adsets s ON s.id = a.adset_id
JOIN public.campaigns c ON c.id = s.campaign_id
WHERE i.ad_id = a.id
  AND i.ad_account_id IS NULL;

UPDATE public.insight_actions ia
SET ad_account_id = c.ad_account_id
FROM public.ads a
JOIN public.adsets s ON s.id = a.adset_id
JOIN public.campaigns c ON c.id = s.campaign_id
WHERE ia.ad_id = a.id
  AND ia.ad_account_id IS NULL;

CREATE INDEX IF NOT EXISTS insights_account_date_window_idx
  ON public.insights (ad_account_id, date, attribution_window);

CREATE INDEX IF NOT EXISTS insight_actions_account_date_window_idx
  ON public.insight_actions (ad_account_id, date, attribution_window);

COMMENT ON COLUMN public.insights.ad_account_id IS
  'Internal ad_accounts.id used to scope facts without relying on catalog joins.';

COMMENT ON COLUMN public.insight_actions.ad_account_id IS
  'Internal ad_accounts.id used to scope action facts without relying on catalog joins.';
