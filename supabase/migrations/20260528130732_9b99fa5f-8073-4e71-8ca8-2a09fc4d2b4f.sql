ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS rd_fields_last_discovered_at timestamptz;