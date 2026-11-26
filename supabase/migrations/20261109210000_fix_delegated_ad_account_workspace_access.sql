-- Fix delegated user access to Meta ad accounts in the workspace.
-- 1. Updates ad_accounts to ensure legacy owner accounts receive workspace_id.
-- 2. Aligns user_can_view_ad_account and admin_save_workspace_user_access
--    so that delegated users assigned specific ad accounts can view and sync them reliably.

CREATE OR REPLACE FUNCTION public.user_can_view_ad_account(
  _user_id uuid,
  _ad_account_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ad_accounts account
    WHERE account.id = _ad_account_id
      AND COALESCE((account.metadata ->> 'profile_disconnected')::boolean, false) IS NOT TRUE
      AND (
        public.is_master(_user_id)
        OR public.user_owns_ad_account(_user_id, account.id)
        OR (
          account.workspace_id IS NOT NULL
          AND public.can_manage_workspace(account.workspace_id, _user_id)
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_ad_account_access access
          WHERE access.user_id = _user_id
            AND access.ad_account_id = account.id
            AND (
              access.workspace_id = account.workspace_id
              OR access.workspace_id IS NULL
              OR account.workspace_id IS NULL
              OR public.is_workspace_member(access.workspace_id, _user_id)
            )
            -- A concessão só vale dentro de um workspace onde o usuário é
            -- membro ativo. Sem esta âncora, uma conta legada sem
            -- workspace poderia ser vista por membros de outro cliente.
            AND (
              public.is_workspace_member(access.workspace_id, _user_id)
              OR (
                account.workspace_id IS NOT NULL
                AND public.is_workspace_member(account.workspace_id, _user_id)
              )
              OR (
                account.workspace_id IS NULL
                AND EXISTS (
                  SELECT 1
                  FROM public.workspace_members member
                  JOIN public.workspaces owner_workspace
                    ON owner_workspace.owner_id = account.user_id
                  WHERE member.workspace_id = owner_workspace.id
                    AND member.user_id = _user_id
                    AND member.status = 'active'
                )
              )
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_view_ad_account(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_view_ad_account(uuid, uuid) TO authenticated, service_role;

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

  -- Assegura que contas legadas pertencentes ao owner do workspace recebam o workspace_id
  UPDATE public.ad_accounts account
  SET workspace_id = _workspace_id
  WHERE account.id = ANY(COALESCE(_ad_account_ids, '{}'::uuid[]))
    AND account.workspace_id IS NULL
    AND account.user_id = (SELECT workspace.owner_id FROM public.workspaces workspace WHERE workspace.id = _workspace_id);

  DELETE FROM public.user_ad_account_access
  WHERE user_id = _user_id AND workspace_id = _workspace_id;
  INSERT INTO public.user_ad_account_access (user_id, ad_account_id, workspace_id)
  SELECT _user_id, account.id, _workspace_id
  FROM public.ad_accounts account
  WHERE account.id = ANY(COALESCE(_ad_account_ids, '{}'::uuid[]))
    AND (
      account.workspace_id = _workspace_id
      -- Conta legada sem workspace: só pertence a este workspace se o
      -- proprietário dela for o owner (ou um membro ativo) deste workspace.
      -- Sem esta âncora, uma conta de outro cliente seria concedível.
      OR (
        account.workspace_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.workspace_members member
          WHERE member.workspace_id = _workspace_id
            AND member.user_id = account.user_id
            AND member.status = 'active'
        )
      )
      OR account.user_id = (SELECT workspace.owner_id FROM public.workspaces workspace WHERE workspace.id = _workspace_id)
      OR EXISTS (
        SELECT 1
        FROM public.workspace_members member
        WHERE member.workspace_id = _workspace_id
          AND member.user_id = account.user_id
          AND member.status = 'active'
      )
    )
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
        SELECT 1
        FROM public.workspace_members member
        WHERE member.workspace_id = _workspace_id
          AND member.user_id = funnel.user_id
          AND member.status = 'active'
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
