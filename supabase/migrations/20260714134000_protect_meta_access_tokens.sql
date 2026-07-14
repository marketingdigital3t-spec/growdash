-- Meta tokens must never be readable by the browser. Authenticated users keep
-- access to the operational account fields permitted by RLS; service_role
-- remains able to read the token inside Edge Functions.
REVOKE SELECT ON TABLE public.ad_accounts FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  account_id,
  name,
  connection_status,
  created_at,
  updated_at,
  daily_budget,
  last_sync_attempt_at,
  last_sync_error,
  last_sync_error_code,
  last_sync_success_at,
  min_spend_threshold,
  remaining_balance,
  target_cpl,
  currency,
  timezone_name,
  timezone_offset_hours_utc,
  provider_account_id,
  metadata
) ON TABLE public.ad_accounts TO authenticated;

GRANT ALL ON TABLE public.ad_accounts TO service_role;

COMMENT ON COLUMN public.ad_accounts.access_token IS
  'Server-only Meta token. Never expose through authenticated/anon SELECT grants.';
