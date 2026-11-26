-- Monthly traffic investment planning and weekly contributions.
-- Additive. Requires workspace_billing_finance_foundation.sql.

CREATE TABLE IF NOT EXISTS public.traffic_investment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  plan_month date NOT NULL CHECK (date_trunc('month', plan_month)::date = plan_month),
  planned_monthly numeric(16,2) NOT NULL DEFAULT 0 CHECK (planned_monthly >= 0),
  meta_percentage numeric(7,4) NOT NULL DEFAULT 100 CHECK (meta_percentage BETWEEN 0 AND 100),
  target_cpl numeric(16,2) CHECK (target_cpl IS NULL OR target_cpl > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, business_unit_id, plan_month, ad_account_id)
);

CREATE TABLE IF NOT EXISTS public.traffic_investment_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.traffic_investment_plans(id) ON DELETE SET NULL,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta','google')),
  amount numeric(16,2) NOT NULL CHECK (amount > 0),
  contributed_at date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_traffic_plans_month ON public.traffic_investment_plans(workspace_id, business_unit_id, plan_month);
CREATE INDEX IF NOT EXISTS idx_traffic_contributions_month ON public.traffic_investment_contributions(workspace_id, business_unit_id, contributed_at, ad_account_id);

ALTER TABLE public.traffic_investment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traffic_investment_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view traffic investment plans" ON public.traffic_investment_plans FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Finance manages traffic investment plans" ON public.traffic_investment_plans FOR ALL TO authenticated
  USING (public.can_manage_finance(workspace_id)) WITH CHECK (public.can_manage_finance(workspace_id));
CREATE POLICY "Members view traffic contributions" ON public.traffic_investment_contributions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Finance creates traffic contributions" ON public.traffic_investment_contributions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finance(workspace_id) AND created_by = auth.uid());
CREATE POLICY "Finance removes traffic contributions" ON public.traffic_investment_contributions FOR DELETE TO authenticated
  USING (public.can_manage_finance(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_investment_plans, public.traffic_investment_contributions TO authenticated;
GRANT ALL ON public.traffic_investment_plans, public.traffic_investment_contributions TO service_role;

