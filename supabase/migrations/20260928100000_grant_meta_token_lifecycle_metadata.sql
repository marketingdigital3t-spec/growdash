-- The token lifecycle columns are operational metadata only; the access_token
-- itself remains server-only. Without this grant, selecting the full
-- ad_accounts inventory fails with a column-level privilege error.
GRANT SELECT (
  token_issued_at,
  token_expires_at,
  token_refreshed_at,
  token_refresh_source
) ON public.ad_accounts TO authenticated;
