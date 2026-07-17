ALTER TABLE public.insights
  ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_inline_link_clicks BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.insights.inline_link_clicks IS 'Cliques no link retornados pelo Meta Ads Insights.';
COMMENT ON COLUMN public.insights.unique_inline_link_clicks IS 'Pessoas que clicaram no link, usada para CTR único.';
