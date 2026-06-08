-- ============================================================
-- Apply manually in Supabase SQL editor.
-- Creates tables required by sync-meta-transactions and sync-meta-leads.
-- ============================================================

-- ACCOUNT_TRANSACTIONS (histórico de cobranças da Meta)
CREATE TABLE IF NOT EXISTS public.account_transactions (
  id text PRIMARY KEY,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  time timestamptz NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text,
  status text,
  payment_method text,
  billing_reason text,
  reference text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_transactions_account_time
  ON public.account_transactions (ad_account_id, time DESC);

GRANT SELECT ON public.account_transactions TO authenticated;
GRANT ALL ON public.account_transactions TO service_role;

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their account transactions" ON public.account_transactions;
CREATE POLICY "Users view their account transactions"
  ON public.account_transactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_accounts a
      WHERE a.id = account_transactions.ad_account_id
        AND a.user_id = auth.uid()
    )
  );

-- META_LEADS (Lead Ads / leadgen forms)
CREATE TABLE IF NOT EXISTS public.meta_leads (
  meta_lead_id text PRIMARY KEY,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  campaign_id text,
  adset_id text,
  ad_id text,
  form_id text,
  created_time timestamptz NOT NULL,
  field_data jsonb,
  email text,
  phone text,
  full_name text,
  lead_state text,
  lead_state_source text,
  lead_city text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_leads_account_time
  ON public.meta_leads (ad_account_id, created_time DESC);
CREATE INDEX IF NOT EXISTS idx_meta_leads_email
  ON public.meta_leads (email);

GRANT SELECT ON public.meta_leads TO authenticated;
GRANT ALL ON public.meta_leads TO service_role;

ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their meta leads" ON public.meta_leads;
CREATE POLICY "Users view their meta leads"
  ON public.meta_leads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_accounts a
      WHERE a.id = meta_leads.ad_account_id
        AND a.user_id = auth.uid()
    )
  );
