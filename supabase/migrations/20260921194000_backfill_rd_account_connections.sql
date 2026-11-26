-- Backfill the new connection identity without changing existing credentials.
-- The legacy integration is copied into one connection per Meta account/funnel
-- owner; future connection management can replace these rows explicitly.
INSERT INTO public.rd_account_connections (
  user_id, workspace_id, external_account_id, account_name, api_token, status,
  last_error, created_at, updated_at
)
SELECT DISTINCT
  i.user_id,
  a.workspace_id,
  a.account_id,
  COALESCE(a.name, 'Conta RD sem conta Meta'),
  i.api_token,
  CASE WHEN i.is_active THEN 'connected' ELSE 'blocked' END,
  CASE WHEN i.is_active THEN NULL ELSE 'Integração RD legada desativada' END,
  now(), now()
FROM public.integrations i
LEFT JOIN public.ad_accounts a ON a.user_id = i.user_id
WHERE i.provider = 'rd_station_crm'
  AND a.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.rd_account_connections c
    WHERE c.user_id = i.user_id AND c.external_account_id = a.account_id
  );

-- RD-only funnels receive a stable owner connection as well. This preserves
-- their visibility when no Meta account is linked.
INSERT INTO public.rd_account_connections (
  user_id, workspace_id, external_account_id, account_name, api_token, status,
  created_at, updated_at
)
SELECT DISTINCT i.user_id, NULL::uuid, NULL::text, 'RD Station · conexão legada', i.api_token,
  CASE WHEN i.is_active THEN 'connected' ELSE 'blocked' END, now(), now()
FROM public.integrations i
JOIN public.rd_funnels f ON f.user_id = i.user_id AND f.ad_account_id IS NULL
WHERE i.provider = 'rd_station_crm'
  AND NOT EXISTS (
    SELECT 1 FROM public.rd_account_connections c
    WHERE c.user_id = i.user_id AND c.external_account_id IS NULL
  );

UPDATE public.rd_funnels f
SET rd_connection_id = c.id
FROM public.rd_account_connections c
WHERE f.rd_connection_id IS NULL
  AND f.user_id = c.user_id
  AND ((f.ad_account_id IS NOT NULL AND c.external_account_id = (SELECT a.account_id FROM public.ad_accounts a WHERE a.id = f.ad_account_id))
    OR (f.ad_account_id IS NULL AND c.external_account_id IS NULL));

UPDATE public.rd_deals d
SET rd_connection_id = f.rd_connection_id
FROM public.rd_funnels f
WHERE d.rd_connection_id IS NULL AND d.rd_funnel_id = f.id AND f.rd_connection_id IS NOT NULL;
