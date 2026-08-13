-- Strategic planning is tenant-scoped. One plan represents one workspace + brand/account.
CREATE TABLE IF NOT EXISTS public.strategy_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  brand_name text NOT NULL,
  positioning text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  content_pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (workspace_id, ad_account_id)
);

CREATE INDEX IF NOT EXISTS strategy_plans_workspace_account_idx ON public.strategy_plans(workspace_id, ad_account_id);
ALTER TABLE public.strategy_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_plans TO authenticated;

DROP POLICY IF EXISTS "Members can read strategy plans" ON public.strategy_plans;
CREATE POLICY "Members can read strategy plans" ON public.strategy_plans
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Members can create strategy plans" ON public.strategy_plans;
CREATE POLICY "Members can create strategy plans" ON public.strategy_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Members can update strategy plans" ON public.strategy_plans;
CREATE POLICY "Members can update strategy plans" ON public.strategy_plans
  FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "Members can delete strategy plans" ON public.strategy_plans;
CREATE POLICY "Members can delete strategy plans" ON public.strategy_plans
  FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS update_strategy_plans_updated_at ON public.strategy_plans;
CREATE TRIGGER update_strategy_plans_updated_at
  BEFORE UPDATE ON public.strategy_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
