ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS daily_budget numeric,
  ADD COLUMN IF NOT EXISTS lifetime_budget numeric;

COMMENT ON COLUMN public.campaigns.daily_budget IS
  'Orçamento diário no nível da campanha (Advantage Campaign Budget/CBO), em moeda da conta.';
COMMENT ON COLUMN public.campaigns.lifetime_budget IS
  'Orçamento vitalício no nível da campanha, em moeda da conta.';
