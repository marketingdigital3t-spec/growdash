-- Growdash SaaS foundation: tenant isolation, business units, plans and finance.
-- This migration is additive and keeps the existing user-owned records working.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS density text NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'BRL',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'financial', 'analyst', 'member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_finance(_workspace_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner', 'admin', 'financial')
  )
$$;

CREATE TABLE IF NOT EXISTS public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('infoproduto', 'saas')),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind)
);

CREATE TABLE IF NOT EXISTS public.plan_catalog (
  code text PRIMARY KEY,
  name text NOT NULL,
  monthly_price numeric(12,2) NOT NULL,
  description text NOT NULL,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.plan_catalog (code, name, monthly_price, description, entitlements, sort_order)
VALUES
  ('starter', 'Starter', 97, 'Operação enxuta para validar a gestão em um único workspace.', '{"ad_accounts":2,"users":2,"ai_credits":150,"automations":3,"whatsapp_reports":100,"history_months":3}'::jsonb, 1),
  ('growth', 'Growth', 197, 'Crescimento com mais contas, IA, automações e histórico.', '{"ad_accounts":6,"users":5,"ai_credits":600,"automations":15,"whatsapp_reports":500,"history_months":12}'::jsonb, 2),
  ('scale', 'Scale', 397, 'Operação avançada para equipes e múltiplas unidades.', '{"ad_accounts":15,"users":12,"ai_credits":2000,"automations":50,"whatsapp_reports":2000,"history_months":24}'::jsonb, 3),
  ('agency', 'Agency', 797, 'Gestão de alto volume com limites ampliados e atendimento prioritário.', '{"ad_accounts":40,"users":30,"ai_credits":6000,"automations":150,"whatsapp_reports":6000,"history_months":36}'::jsonb, 4)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  description = EXCLUDED.description,
  entitlements = EXCLUDED.entitlements,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.plan_catalog(code),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period date NOT NULL,
  quantity numeric NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, metric, period)
);

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('revenue', 'expense')),
  color text NOT NULL DEFAULT '#d5a62a',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name, entry_type)
);

CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('revenue', 'expense')),
  description text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  competence_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  paid_at date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'canceled')),
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly', 'yearly')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_units_workspace ON public.business_units(workspace_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_workspace_date ON public.financial_entries(workspace_id, competence_date DESC);

ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.ensure_current_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _workspace_id uuid;
  _email text;
  _name text;
  _info_unit uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT workspace_id INTO _workspace_id
  FROM public.workspace_members
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at
  LIMIT 1;

  IF _workspace_id IS NULL THEN
    SELECT email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
      INTO _email, _name
    FROM auth.users WHERE id = _user_id;

    INSERT INTO public.workspaces (owner_id, name, slug)
    VALUES (_user_id, COALESCE(NULLIF(_name, ''), 'Minha Growdash'), 'workspace-' || replace(_user_id::text, '-', ''))
    RETURNING id INTO _workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (_workspace_id, _user_id, 'owner');

    INSERT INTO public.business_units (workspace_id, kind, name)
    VALUES (_workspace_id, 'infoproduto', 'Infoproduto'), (_workspace_id, 'saas', 'SaaS');

    INSERT INTO public.workspace_subscriptions (workspace_id, plan_code, status, trial_ends_at)
    VALUES (_workspace_id, 'starter', 'trialing', now() + interval '14 days');

    INSERT INTO public.financial_categories (workspace_id, name, entry_type)
    VALUES
      (_workspace_id, 'Vendas', 'revenue'),
      (_workspace_id, 'Assinaturas', 'revenue'),
      (_workspace_id, 'Tráfego pago', 'expense'),
      (_workspace_id, 'Ferramentas', 'expense'),
      (_workspace_id, 'Equipe', 'expense');
  END IF;

  SELECT id INTO _info_unit FROM public.business_units
  WHERE workspace_id = _workspace_id AND kind = 'infoproduto' LIMIT 1;

  UPDATE public.ad_accounts
  SET workspace_id = _workspace_id, business_unit_id = COALESCE(business_unit_id, _info_unit)
  WHERE user_id = _user_id AND workspace_id IS NULL;

  UPDATE public.sales
  SET workspace_id = _workspace_id, business_unit_id = COALESCE(business_unit_id, _info_unit)
  WHERE user_id = _user_id AND workspace_id IS NULL;

  RETURN _workspace_id;
END;
$$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view workspace" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));
CREATE POLICY "Owners update workspace" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(id)) WITH CHECK (public.can_manage_workspace(id));
CREATE POLICY "Members view membership" ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins manage membership" ON public.workspace_members FOR ALL TO authenticated
  USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members view business units" ON public.business_units FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins manage business units" ON public.business_units FOR ALL TO authenticated
  USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Authenticated view plans" ON public.plan_catalog FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "Members view subscription" ON public.workspace_subscriptions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view usage" ON public.workspace_usage_monthly FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members view financial categories" ON public.financial_categories FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Finance admins manage categories" ON public.financial_categories FOR ALL TO authenticated
  USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Members view financial entries" ON public.financial_entries FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members create financial entries" ON public.financial_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_finance(workspace_id) AND user_id = auth.uid());
CREATE POLICY "Finance users update financial entries" ON public.financial_entries FOR UPDATE TO authenticated
  USING (public.can_manage_finance(workspace_id))
  WITH CHECK (public.can_manage_finance(workspace_id));
CREATE POLICY "Finance admins delete financial entries" ON public.financial_entries FOR DELETE TO authenticated
  USING (public.can_manage_finance(workspace_id));

GRANT SELECT, UPDATE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members, public.business_units, public.financial_categories, public.financial_entries TO authenticated;
GRANT SELECT ON public.plan_catalog, public.workspace_subscriptions, public.workspace_usage_monthly TO authenticated;
GRANT ALL ON public.workspaces, public.workspace_members, public.business_units, public.plan_catalog,
  public.workspace_subscriptions, public.workspace_usage_monthly, public.financial_categories, public.financial_entries TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_current_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workspace(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_finance(uuid, uuid) TO authenticated;

-- Keep the browser allow-list explicit after adding tenant columns to ad_accounts.
GRANT SELECT (workspace_id, business_unit_id) ON TABLE public.ad_accounts TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Public avatar access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
