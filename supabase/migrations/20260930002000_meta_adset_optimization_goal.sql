ALTER TABLE public.adsets
  ADD COLUMN IF NOT EXISTS optimization_goal text;

COMMENT ON COLUMN public.adsets.optimization_goal IS
  'Meta ad set optimization goal used to resolve the official Ads Manager result.';
