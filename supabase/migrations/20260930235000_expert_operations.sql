-- Expert operations: canonical class participants, spreadsheet sales and source mapping.
CREATE TABLE IF NOT EXISTS public.expert_operation_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  student_funnel_id uuid REFERENCES public.rd_funnels(id) ON DELETE SET NULL,
  model_patient_funnel_id uuid REFERENCES public.rd_funnels(id) ON DELETE SET NULL,
  attribution_window text NOT NULL DEFAULT 'account_default',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_id, ad_account_id)
);

CREATE TABLE IF NOT EXISTS public.expert_sheet_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  participant_type text NOT NULL CHECK (participant_type IN ('student','model_patient')),
  spreadsheet_id text NOT NULL,
  worksheet_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','syncing','fresh','stale','error')),
  last_sync_at timestamptz,
  last_valid_snapshot_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expert_id, participant_type)
);

CREATE TABLE IF NOT EXISTS public.expert_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  event_class_id uuid REFERENCES public.event_classes(id) ON DELETE SET NULL,
  sheet_connection_id uuid REFERENCES public.expert_sheet_connections(id) ON DELETE SET NULL,
  participant_type text NOT NULL CHECK (participant_type IN ('student','model_patient')),
  source_row_hash text NOT NULL,
  source_row_number integer,
  name text NOT NULL,
  sale_date date,
  class_name text,
  gross_amount_cents integer NOT NULL DEFAULT 0 CHECK (gross_amount_cents >= 0),
  cash_received_cents integer NOT NULL DEFAULT 0 CHECK (cash_received_cents >= 0),
  status text NOT NULL DEFAULT 'confirmed',
  seller_name text,
  payment_method text,
  utm_campaign text,
  utm_content text,
  notes text,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sheet_connection_id, source_row_hash)
);

CREATE TABLE IF NOT EXISTS public.expert_sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  seller_name text NOT NULL,
  goal_month date NOT NULL,
  target_cents integer NOT NULL DEFAULT 0 CHECK (target_cents >= 0),
  UNIQUE (expert_id, seller_name, goal_month)
);

CREATE TABLE IF NOT EXISTS public.expert_sales_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.experts(id) ON DELETE CASCADE,
  sheet_connection_id uuid REFERENCES public.expert_sheet_connections(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('success','partial','error')),
  rows_read integer NOT NULL DEFAULT 0,
  rows_upserted integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS expert_operation_sources_expert_idx ON public.expert_operation_sources(expert_id);
CREATE INDEX IF NOT EXISTS expert_sales_scope_idx ON public.expert_sales(expert_id, participant_type, sale_date);
CREATE INDEX IF NOT EXISTS expert_sales_class_idx ON public.expert_sales(event_class_id, participant_type);
CREATE INDEX IF NOT EXISTS expert_sales_goals_idx ON public.expert_sales_goals(expert_id, goal_month);

ALTER TABLE public.expert_operation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_sheet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_sales_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_sales_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read expert operation sources" ON public.expert_operation_sources FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.is_workspace_member(e.workspace_id)));
CREATE POLICY "Managers manage expert operation sources" ON public.expert_operation_sources FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id)));
CREATE POLICY "Members read expert sheet connections" ON public.expert_sheet_connections FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.is_workspace_member(e.workspace_id)));
CREATE POLICY "Managers manage expert sheet connections" ON public.expert_sheet_connections FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id)));
CREATE POLICY "Members read expert sales" ON public.expert_sales FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.is_workspace_member(e.workspace_id)));
CREATE POLICY "Managers manage expert sales" ON public.expert_sales FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id)));
CREATE POLICY "Members read expert sales goals" ON public.expert_sales_goals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.is_workspace_member(e.workspace_id)));
CREATE POLICY "Managers manage expert sales goals" ON public.expert_sales_goals FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id)));
CREATE POLICY "Members read expert sales sync runs" ON public.expert_sales_sync_runs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.is_workspace_member(e.workspace_id)));
CREATE POLICY "Managers manage expert sales sync runs" ON public.expert_sales_sync_runs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.experts e WHERE e.id = expert_id AND public.can_manage_workspace(e.workspace_id)));
