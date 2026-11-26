ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_sync_error text,
  ADD COLUMN IF NOT EXISTS last_sync_error_code integer,
  ADD COLUMN IF NOT EXISTS last_sync_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_success_at timestamptz;