-- Monthly sales goals used by the Dashboard progress bar.
-- Additive. Requires workspace_billing_finance_foundation.sql.

CREATE TABLE IF NOT EXISTS public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  goal_month date NOT NULL CHECK (date_trunc('month', goal_month)::date = goal_month),
  target_revenue numeric(16,2) NOT NULL CHECK (target_revenue > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, business_unit_id, ad_account_id, goal_month)
);

CREATE INDEX IF NOT EXISTS idx_sales_goals_scope_month
  ON public.sales_goals(workspace_id, business_unit_id, goal_month, ad_account_id);

CREATE OR REPLACE FUNCTION public.validate_sales_goal_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ad_accounts account
    JOIN public.business_units unit ON unit.id = NEW.business_unit_id
    WHERE account.id = NEW.ad_account_id
      AND account.workspace_id = NEW.workspace_id
      AND account.business_unit_id = NEW.business_unit_id
      AND unit.workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'sales goal account, unit and workspace do not share the same scope';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sales_goal_scope ON public.sales_goals;
CREATE TRIGGER trg_validate_sales_goal_scope
BEFORE INSERT OR UPDATE ON public.sales_goals
FOR EACH ROW EXECUTE FUNCTION public.validate_sales_goal_scope();

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view sales goals" ON public.sales_goals FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Finance manages sales goals" ON public.sales_goals FOR ALL TO authenticated
  USING (public.can_manage_finance(workspace_id))
  WITH CHECK (public.can_manage_finance(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_goals TO authenticated;
GRANT ALL ON public.sales_goals TO service_role;
