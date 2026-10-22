-- Link confirmed Meta ad-account funding transactions to the workspace
-- financial ledger without creating duplicates on repeated syncs.
ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS source_provider text,
  ADD COLUMN IF NOT EXISTS source_external_id text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_source_unique_idx
  ON public.financial_entries (workspace_id, source_provider, source_external_id);

CREATE INDEX IF NOT EXISTS financial_entries_ad_account_date_idx
  ON public.financial_entries (ad_account_id, competence_date DESC)
  WHERE ad_account_id IS NOT NULL;

COMMENT ON COLUMN public.financial_entries.source_provider IS
  'Origin of an imported ledger entry, for example meta_ads or manual.';
COMMENT ON COLUMN public.financial_entries.source_external_id IS
  'Stable provider transaction id used for idempotent reconciliation.';
COMMENT ON COLUMN public.financial_entries.payment_method IS
  'Normalized payment method reported by the provider; never inferred when unavailable.';
