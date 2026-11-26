-- Access rows for deleted ad accounts can never grant data access and make
-- permission diagnostics misleading. Remove only links whose target account
-- no longer exists; valid workspace-scoped assignments are untouched.
DELETE FROM public.user_ad_account_access access
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ad_accounts account
  WHERE account.id = access.ad_account_id
);
