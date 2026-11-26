-- Bootstrap reads are scoped by the authenticated owner/workspace and then
-- ordered for display. These composite indexes avoid a full table scan plus
-- sort while preserving the existing RLS predicates.
CREATE INDEX IF NOT EXISTS ad_accounts_user_created_idx
  ON public.ad_accounts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rd_funnels_user_created_idx
  ON public.rd_funnels (user_id, created_at ASC);

CREATE INDEX IF NOT EXISTS rd_account_connections_user_name_idx
  ON public.rd_account_connections (user_id, account_name ASC);

CREATE INDEX IF NOT EXISTS products_user_created_idx
  ON public.products (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS business_units_workspace_active_kind_idx
  ON public.business_units (workspace_id, is_active, kind);
