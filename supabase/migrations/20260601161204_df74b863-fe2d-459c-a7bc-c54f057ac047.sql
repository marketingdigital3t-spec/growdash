ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS funding_type text,
  ADD COLUMN IF NOT EXISTS funding_display text;