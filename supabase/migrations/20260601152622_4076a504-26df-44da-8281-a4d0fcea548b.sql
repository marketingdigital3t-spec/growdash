
CREATE TABLE public.account_transactions (
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
  inserted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_transactions_account_time
  ON public.account_transactions (ad_account_id, time DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transactions TO authenticated;
GRANT ALL ON public.account_transactions TO service_role;

ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View account_transactions"
  ON public.account_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert account_transactions"
  ON public.account_transactions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Update account_transactions"
  ON public.account_transactions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete account_transactions"
  ON public.account_transactions FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
