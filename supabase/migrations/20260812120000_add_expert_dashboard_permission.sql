-- A dedicated read-only dashboard permission. This is additive: it neither
-- changes existing permissions nor expands account access.
ALTER TABLE IF EXISTS public.workspace_user_permissions
  ADD COLUMN IF NOT EXISTS can_expert_dashboard boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.user_permissions
  ADD COLUMN IF NOT EXISTS can_expert_dashboard boolean NOT NULL DEFAULT false;

-- Keep the workspace management RPC as the single writer for permission and
-- account scope. Its caller is service-role-only (see security hardening).
CREATE OR REPLACE FUNCTION public.admin_save_workspace_user_access(
  _workspace_id uuid,
  _user_id uuid,
  _email text,
  _role text,
  _permissions jsonb DEFAULT '{}'::jsonb,
  _ad_account_ids uuid[] DEFAULT '{}'::uuid[],
  _rd_funnel_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _role NOT IN ('admin', 'analyst', 'member') THEN
    RAISE EXCEPTION 'Papel de acesso inválido.';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (_workspace_id, _user_id, _role, 'active')
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active';

  INSERT INTO public.workspace_user_permissions (
    workspace_id, user_id, username, can_expert_dashboard, can_dashboard,
    can_campaigns, can_funnels, can_classes, can_crm, can_commercial,
    can_leads, can_alerts, can_users, can_integrations, can_announcements,
    can_automations, can_flow, can_social_media, can_kanban, can_tickets,
    can_finance, can_storage, can_brands, can_products, can_meta_connect,
    can_agents, can_settings, can_data_health, updated_at
  ) VALUES (
    _workspace_id, _user_id, lower(trim(_email)),
    COALESCE((_permissions->>'can_expert_dashboard')::boolean, false),
    COALESCE((_permissions->>'can_dashboard')::boolean, false),
    COALESCE((_permissions->>'can_campaigns')::boolean, false),
    COALESCE((_permissions->>'can_funnels')::boolean, false),
    COALESCE((_permissions->>'can_classes')::boolean, false),
    COALESCE((_permissions->>'can_crm')::boolean, false),
    COALESCE((_permissions->>'can_commercial')::boolean, false),
    COALESCE((_permissions->>'can_leads')::boolean, false),
    COALESCE((_permissions->>'can_alerts')::boolean, false),
    COALESCE((_permissions->>'can_users')::boolean, false),
    COALESCE((_permissions->>'can_integrations')::boolean, false),
    COALESCE((_permissions->>'can_announcements')::boolean, false),
    COALESCE((_permissions->>'can_automations')::boolean, false),
    COALESCE((_permissions->>'can_flow')::boolean, false),
    COALESCE((_permissions->>'can_social_media')::boolean, false),
    COALESCE((_permissions->>'can_kanban')::boolean, false),
    COALESCE((_permissions->>'can_tickets')::boolean, false),
    COALESCE((_permissions->>'can_finance')::boolean, false),
    COALESCE((_permissions->>'can_storage')::boolean, false),
    COALESCE((_permissions->>'can_brands')::boolean, false),
    COALESCE((_permissions->>'can_products')::boolean, false),
    COALESCE((_permissions->>'can_meta_connect')::boolean, false),
    COALESCE((_permissions->>'can_agents')::boolean, false),
    COALESCE((_permissions->>'can_settings')::boolean, false),
    COALESCE((_permissions->>'can_data_health')::boolean, false), now()
  ) ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    username = EXCLUDED.username, can_expert_dashboard = EXCLUDED.can_expert_dashboard,
    can_dashboard = EXCLUDED.can_dashboard, can_campaigns = EXCLUDED.can_campaigns,
    can_funnels = EXCLUDED.can_funnels, can_classes = EXCLUDED.can_classes,
    can_crm = EXCLUDED.can_crm, can_commercial = EXCLUDED.can_commercial,
    can_leads = EXCLUDED.can_leads, can_alerts = EXCLUDED.can_alerts,
    can_users = EXCLUDED.can_users, can_integrations = EXCLUDED.can_integrations,
    can_announcements = EXCLUDED.can_announcements, can_automations = EXCLUDED.can_automations,
    can_flow = EXCLUDED.can_flow, can_social_media = EXCLUDED.can_social_media,
    can_kanban = EXCLUDED.can_kanban, can_tickets = EXCLUDED.can_tickets,
    can_finance = EXCLUDED.can_finance, can_storage = EXCLUDED.can_storage,
    can_brands = EXCLUDED.can_brands, can_products = EXCLUDED.can_products,
    can_meta_connect = EXCLUDED.can_meta_connect, can_agents = EXCLUDED.can_agents,
    can_settings = EXCLUDED.can_settings, can_data_health = EXCLUDED.can_data_health,
    updated_at = now();

  DELETE FROM public.user_ad_account_access WHERE user_id = _user_id AND workspace_id = _workspace_id;
  INSERT INTO public.user_ad_account_access (user_id, ad_account_id, workspace_id)
  SELECT _user_id, account.id, _workspace_id FROM public.ad_accounts account
  WHERE account.id = ANY(COALESCE(_ad_account_ids, '{}'::uuid[])) AND account.workspace_id = _workspace_id
  ON CONFLICT (user_id, ad_account_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;

  DELETE FROM public.user_rd_funnel_access WHERE user_id = _user_id AND workspace_id = _workspace_id;
  INSERT INTO public.user_rd_funnel_access (user_id, rd_funnel_id, workspace_id)
  SELECT _user_id, funnel.id, _workspace_id FROM public.rd_funnels funnel
  WHERE funnel.id = ANY(COALESCE(_rd_funnel_ids, '{}'::uuid[])) AND funnel.workspace_id = _workspace_id
  ON CONFLICT (user_id, rd_funnel_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) TO service_role;
