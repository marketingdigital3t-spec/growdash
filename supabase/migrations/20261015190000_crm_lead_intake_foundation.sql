-- Canonical first-party lead intake for a workspace-owned CRM.
-- Provider-specific records (Meta/RD) remain canonical for their own facts;
-- this table is the normalized operational inbox for new inbound leads.
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_provider text NOT NULL DEFAULT 'webhook',
  external_id text,
  full_name text,
  email text,
  phone text,
  lead_city text,
  lead_state text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'opportunity', 'won', 'lost', 'archived')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  fbclid text,
  gclid text,
  ttclid text,
  landing_page text,
  referrer text,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_workspace_source_external_uidx
  ON public.crm_leads (workspace_id, source_provider, external_id);
CREATE INDEX IF NOT EXISTS crm_leads_workspace_status_date_idx
  ON public.crm_leads (workspace_id, status, first_received_at DESC);
CREATE INDEX IF NOT EXISTS crm_leads_workspace_email_idx
  ON public.crm_leads (workspace_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_leads_workspace_phone_idx
  ON public.crm_leads (workspace_id, phone)
  WHERE phone IS NOT NULL;

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;

DROP POLICY IF EXISTS "Workspace members read CRM leads" ON public.crm_leads;
CREATE POLICY "Workspace members read CRM leads"
  ON public.crm_leads FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace editors create CRM leads" ON public.crm_leads;
CREATE POLICY "Workspace editors create CRM leads"
  ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_workspace(workspace_id));

DROP POLICY IF EXISTS "Workspace editors update CRM leads" ON public.crm_leads;
CREATE POLICY "Workspace editors update CRM leads"
  ON public.crm_leads FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id))
  WITH CHECK (public.can_edit_workspace(workspace_id));

CREATE TABLE IF NOT EXISTS public.crm_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  endpoint_key text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  secret_hint text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  last_received_at timestamptz,
  received_count bigint NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_webhook_endpoints_workspace_active_uidx
  ON public.crm_webhook_endpoints (workspace_id)
  WHERE active;
CREATE INDEX IF NOT EXISTS crm_webhook_endpoints_workspace_idx
  ON public.crm_webhook_endpoints (workspace_id, created_at DESC);

ALTER TABLE public.crm_webhook_endpoints ENABLE ROW LEVEL SECURITY;
-- Endpoint secrets are intentionally managed by Edge Functions only. The
-- browser receives a one-time secret from the authenticated config function,
-- never a table row containing the hash.
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated;
