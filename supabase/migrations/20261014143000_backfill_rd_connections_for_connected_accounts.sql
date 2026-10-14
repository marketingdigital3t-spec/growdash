-- Keep the per-account RD inventory complete when a Meta account is connected
-- after the original legacy backfill. The RD token remains server-side; this
-- only creates the safe, auditable connection metadata row used by the UI and
-- sync workers.
INSERT INTO public.rd_account_connections (
  user_id,
  workspace_id,
  external_account_id,
  account_name,
  api_token,
  status,
  created_at,
  updated_at
)
SELECT
  integration.user_id,
  account.workspace_id,
  account.account_id,
  account.name,
  integration.api_token,
  CASE WHEN integration.is_active THEN 'connected' ELSE 'blocked' END,
  now(),
  now()
FROM public.integrations integration
JOIN public.ad_accounts account ON account.user_id = integration.user_id
WHERE integration.provider = 'rd_station_crm'
  AND account.connection_status = 'connected'
  AND account.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.rd_account_connections existing
    WHERE existing.user_id = integration.user_id
      AND existing.external_account_id = account.account_id
  );
