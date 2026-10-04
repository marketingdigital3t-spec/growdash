-- Reconcile Meta conversions again throughout the account's attribution
-- window; the five-minute worker timestamp overlap was being reduced to civil
-- dates and therefore only refreshed the current day.

-- Preserve the existing workspace access contract while allowing a selected
-- RD-only/connection-backed funnel to receive the same explicit workspace
-- grant as a funnel attached directly to an ad_accounts row.
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

  DELETE FROM public.user_ad_account_access
  WHERE user_id = _user_id AND workspace_id = _workspace_id;
  INSERT INTO public.user_ad_account_access (user_id, ad_account_id, workspace_id)
  SELECT _user_id, account.id, _workspace_id
  FROM public.ad_accounts account
  WHERE account.id = ANY(COALESCE(_ad_account_ids, '{}'::uuid[]))
    AND account.workspace_id = _workspace_id
  ON CONFLICT (user_id, ad_account_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;

  DELETE FROM public.user_rd_funnel_access
  WHERE user_id = _user_id AND workspace_id = _workspace_id;
  INSERT INTO public.user_rd_funnel_access (user_id, rd_funnel_id, workspace_id)
  SELECT _user_id, funnel.id, _workspace_id
  FROM public.rd_funnels funnel
  LEFT JOIN public.ad_accounts account ON account.id = funnel.ad_account_id
  LEFT JOIN public.rd_account_connections connection ON connection.id = funnel.rd_connection_id
  WHERE funnel.id = ANY(COALESCE(_rd_funnel_ids, '{}'::uuid[]))
    AND (
      account.workspace_id = _workspace_id
      OR connection.workspace_id = _workspace_id
      OR (
        connection.workspace_id IS NULL
        AND connection.user_id = (SELECT workspace.owner_id FROM public.workspaces workspace WHERE workspace.id = _workspace_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.ad_accounts linked_account
        WHERE linked_account.workspace_id = _workspace_id
          AND regexp_replace(lower(linked_account.account_id), '^act_', '')
            = regexp_replace(lower(connection.external_account_id), '^act_', '')
      )
    )
  ON CONFLICT (user_id, rd_funnel_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) TO service_role;

-- Workspace members need only the non-secret link between an assigned Meta
-- account and its RD connection. Direct SELECT on rd_account_connections
-- intentionally remains owner-only because that table contains api_token.
CREATE OR REPLACE FUNCTION public.list_workspace_rd_account_connections(_workspace_id uuid)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  external_account_id text,
  account_name text,
  status text,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  permissions jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_workspace_member(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso ao workspace negado.' USING ERRCODE = '42501';
  END IF;

  SELECT workspace.owner_id INTO _owner_id
  FROM public.workspaces workspace
  WHERE workspace.id = _workspace_id;

  RETURN QUERY
  SELECT connection.id, COALESCE(connection.workspace_id, _workspace_id),
         connection.external_account_id, connection.account_name,
         connection.status, connection.last_attempt_at, connection.last_success_at,
         connection.last_error, connection.permissions, connection.created_at,
         connection.updated_at
  FROM public.rd_account_connections connection
  WHERE (
    connection.workspace_id = _workspace_id
    OR (connection.workspace_id IS NULL AND connection.user_id = _owner_id)
  )
  AND EXISTS (
    SELECT 1
    FROM public.ad_accounts account
    WHERE account.workspace_id = _workspace_id
      AND connection.external_account_id IS NOT NULL
      AND regexp_replace(lower(account.account_id), '^act_', '')
        = regexp_replace(lower(connection.external_account_id), '^act_', '')
      AND (
        account.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_ad_account_access access
          WHERE access.user_id = auth.uid()
            AND access.ad_account_id = account.id
            AND access.workspace_id = _workspace_id
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_workspace_rd_account_connections(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_workspace_rd_account_connections(uuid) TO authenticated;

-- An explicit funnel grant is sufficient only while the target remains in a
-- workspace the grantee belongs to; legacy NULL-workspace grants stay usable.
DROP POLICY IF EXISTS "Owners view RD funnels with removed accounts" ON public.rd_funnels;
CREATE POLICY "Owners view RD funnels with removed accounts"
ON public.rd_funnels FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_rd_funnel_access access
    WHERE access.user_id = auth.uid()
      AND access.rd_funnel_id = rd_funnels.id
      AND (access.workspace_id IS NULL OR public.is_workspace_member(access.workspace_id, auth.uid()))
  )
);

DROP POLICY IF EXISTS "Owners view RD deals with removed accounts" ON public.rd_deals;
CREATE POLICY "Owners view RD deals with removed accounts"
ON public.rd_deals FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rd_funnels funnel
    WHERE funnel.id = rd_deals.rd_funnel_id
      AND (
        funnel.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_rd_funnel_access access
          WHERE access.user_id = auth.uid()
            AND access.rd_funnel_id = funnel.id
            AND (access.workspace_id IS NULL OR public.is_workspace_member(access.workspace_id, auth.uid()))
        )
      )
  )
);

DROP POLICY IF EXISTS "Owners view RD stages with removed accounts" ON public.rd_funnel_stages;
CREATE POLICY "Owners view RD stages with removed accounts"
ON public.rd_funnel_stages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rd_funnels funnel
    WHERE funnel.id = rd_funnel_stages.rd_funnel_id
      AND (
        funnel.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_rd_funnel_access access
          WHERE access.user_id = auth.uid()
            AND access.rd_funnel_id = funnel.id
            AND (access.workspace_id IS NULL OR public.is_workspace_member(access.workspace_id, auth.uid()))
        )
      )
  )
);
