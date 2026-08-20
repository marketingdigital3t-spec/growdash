-- Security hardening for Edge Functions, workspace isolation and role-aware writes.
-- Additive/idempotent: existing access rows are preserved and backfilled.

ALTER TABLE IF EXISTS public.user_ad_account_access
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.user_ad_account_access access
SET workspace_id = account.workspace_id
FROM public.ad_accounts account
WHERE access.ad_account_id = account.id
  AND access.workspace_id IS NULL
  AND account.workspace_id IS NOT NULL;

ALTER TABLE IF EXISTS public.user_rd_funnel_access
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.user_rd_funnel_access access
SET workspace_id = account.workspace_id
FROM public.rd_funnels funnel
JOIN public.ad_accounts account ON account.id = funnel.ad_account_id
WHERE access.rd_funnel_id = funnel.id
  AND access.workspace_id IS NULL
  AND account.workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_ad_account_access_workspace_idx
  ON public.user_ad_account_access(user_id, workspace_id, ad_account_id);
CREATE INDEX IF NOT EXISTS user_rd_funnel_access_workspace_idx
  ON public.user_rd_funnel_access(user_id, workspace_id, rd_funnel_id);

-- The legacy access helpers are used by many existing policies. Make them
-- workspace-aware so removing a member from workspace A also removes access
-- to A's accounts/funnels, even when that user remains in workspace B.
CREATE OR REPLACE FUNCTION public.user_owns_ad_account(_user_id uuid, _ad_account_id uuid)
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
      AND account.user_id = _user_id
      AND (
        account.workspace_id IS NULL
        OR public.is_workspace_member(account.workspace_id, _user_id)
        OR public.is_master(_user_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_ad_account(_user_id uuid, _ad_account_id uuid)
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
      AND (
        public.is_master(_user_id)
        OR public.user_owns_ad_account(_user_id, account.id)
        OR EXISTS (
          SELECT 1
          FROM public.user_ad_account_access access
          WHERE access.user_id = _user_id
            AND access.ad_account_id = account.id
            AND (
              access.workspace_id = account.workspace_id
              OR (access.workspace_id IS NULL AND account.workspace_id IS NULL)
            )
            AND (
              account.workspace_id IS NULL
              OR public.is_workspace_member(account.workspace_id, _user_id)
            )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_campaign(_user_id uuid, _campaign_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaigns campaign
    WHERE campaign.id = _campaign_id
      AND public.user_can_view_ad_account(_user_id, campaign.ad_account_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_ad(_user_id uuid, _ad_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ads ad
    JOIN public.adsets adset ON adset.id = ad.adset_id
    JOIN public.campaigns campaign ON campaign.id = adset.campaign_id
    WHERE ad.id = _ad_id
      AND public.user_can_view_ad_account(_user_id, campaign.ad_account_id)
  );
$$;

-- Restrict delegated SELECT policies to active workspace membership and the
-- resource's own workspace.
DROP POLICY IF EXISTS "Assigned users view ad_accounts" ON public.ad_accounts;
CREATE POLICY "Assigned users view ad_accounts"
ON public.ad_accounts FOR SELECT TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), id));

DROP POLICY IF EXISTS "Users can view own ad accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "Users can create ad accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "Users can update own ad accounts" ON public.ad_accounts;
DROP POLICY IF EXISTS "Users can delete own ad accounts" ON public.ad_accounts;
CREATE POLICY "Users can view own ad accounts"
ON public.ad_accounts FOR SELECT TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), id));
CREATE POLICY "Users can create ad accounts"
ON public.ad_accounts FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id)))
  OR public.is_master(auth.uid())
);
CREATE POLICY "Users can update own ad accounts"
ON public.ad_accounts FOR UPDATE TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), id))
WITH CHECK (public.user_can_view_ad_account(auth.uid(), id));
CREATE POLICY "Users can delete own ad accounts"
ON public.ad_accounts FOR DELETE TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), id));

DROP POLICY IF EXISTS "Assigned users view campaigns" ON public.campaigns;
CREATE POLICY "Assigned users view campaigns"
ON public.campaigns FOR SELECT TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), ad_account_id));

DROP POLICY IF EXISTS "Assigned users view adsets" ON public.adsets;
CREATE POLICY "Assigned users view adsets"
ON public.adsets FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns campaign
  WHERE campaign.id = adsets.campaign_id
    AND public.user_can_view_ad_account(auth.uid(), campaign.ad_account_id)
));

DROP POLICY IF EXISTS "Assigned users view ads" ON public.ads;
CREATE POLICY "Assigned users view ads"
ON public.ads FOR SELECT TO authenticated
USING (public.user_can_access_ad(auth.uid(), id));

DROP POLICY IF EXISTS "Assigned users view insights_hourly" ON public.insights_hourly;
CREATE POLICY "Assigned users view insights_hourly"
ON public.insights_hourly FOR SELECT TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), ad_account_id));

DROP POLICY IF EXISTS "Assigned users view rd_deals" ON public.rd_deals;
CREATE POLICY "Assigned users view rd_deals"
ON public.rd_deals FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.rd_funnels funnel
  WHERE funnel.id = rd_deals.rd_funnel_id
    AND public.user_can_view_ad_account(auth.uid(), funnel.ad_account_id)
));

DROP POLICY IF EXISTS "Assigned users view rd_deal_touches" ON public.rd_deal_touches;
CREATE POLICY "Assigned users view rd_deal_touches"
ON public.rd_deal_touches FOR SELECT TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), ad_account_id));

DROP POLICY IF EXISTS "Assigned users view rd_funnels" ON public.rd_funnels;
CREATE POLICY "Assigned users view rd_funnels"
ON public.rd_funnels FOR SELECT TO authenticated
USING (public.user_can_view_ad_account(auth.uid(), ad_account_id));

DROP POLICY IF EXISTS "Assigned users view rd_funnel_stages" ON public.rd_funnel_stages;
CREATE POLICY "Assigned users view rd_funnel_stages"
ON public.rd_funnel_stages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.rd_funnels funnel
  WHERE funnel.id = rd_funnel_stages.rd_funnel_id
    AND public.user_can_view_ad_account(auth.uid(), funnel.ad_account_id)
));

-- Workspace-scoped permission catalog. The legacy user_permissions relation is
-- retained for backwards compatibility while new UI reads this table.
CREATE TABLE IF NOT EXISTS public.workspace_user_permissions (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  can_dashboard boolean NOT NULL DEFAULT false,
  can_campaigns boolean NOT NULL DEFAULT false,
  can_funnels boolean NOT NULL DEFAULT false,
  can_classes boolean NOT NULL DEFAULT false,
  can_crm boolean NOT NULL DEFAULT false,
  can_commercial boolean NOT NULL DEFAULT false,
  can_leads boolean NOT NULL DEFAULT false,
  can_alerts boolean NOT NULL DEFAULT false,
  can_users boolean NOT NULL DEFAULT false,
  can_integrations boolean NOT NULL DEFAULT false,
  can_announcements boolean NOT NULL DEFAULT false,
  can_automations boolean NOT NULL DEFAULT false,
  can_flow boolean NOT NULL DEFAULT false,
  can_social_media boolean NOT NULL DEFAULT false,
  can_kanban boolean NOT NULL DEFAULT false,
  can_tickets boolean NOT NULL DEFAULT false,
  can_finance boolean NOT NULL DEFAULT false,
  can_storage boolean NOT NULL DEFAULT false,
  can_brands boolean NOT NULL DEFAULT false,
  can_products boolean NOT NULL DEFAULT false,
  can_meta_connect boolean NOT NULL DEFAULT false,
  can_agents boolean NOT NULL DEFAULT false,
  can_settings boolean NOT NULL DEFAULT false,
  can_data_health boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  UNIQUE (workspace_id, username)
);

ALTER TABLE public.workspace_user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view workspace permissions" ON public.workspace_user_permissions;
CREATE POLICY "Members view workspace permissions"
ON public.workspace_user_permissions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.can_manage_workspace(workspace_id));
GRANT SELECT ON public.workspace_user_permissions TO authenticated;
GRANT ALL ON public.workspace_user_permissions TO service_role;

-- Replace global access replacement with workspace-local updates.
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
    workspace_id, user_id, username,
    can_dashboard, can_campaigns, can_funnels, can_classes,
    can_crm, can_commercial, can_leads, can_alerts, can_users,
    can_integrations, can_announcements, can_automations,
    can_flow, can_social_media, can_kanban, can_tickets,
    can_finance, can_storage, can_brands, can_products,
    can_meta_connect, can_agents, can_settings, can_data_health,
    updated_at
  )
  VALUES (
    _workspace_id, _user_id, lower(trim(_email)),
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
    COALESCE((_permissions->>'can_data_health')::boolean, false),
    now()
  )
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    username = EXCLUDED.username,
    can_dashboard = EXCLUDED.can_dashboard,
    can_campaigns = EXCLUDED.can_campaigns,
    can_funnels = EXCLUDED.can_funnels,
    can_classes = EXCLUDED.can_classes,
    can_crm = EXCLUDED.can_crm,
    can_commercial = EXCLUDED.can_commercial,
    can_leads = EXCLUDED.can_leads,
    can_alerts = EXCLUDED.can_alerts,
    can_users = EXCLUDED.can_users,
    can_integrations = EXCLUDED.can_integrations,
    can_announcements = EXCLUDED.can_announcements,
    can_automations = EXCLUDED.can_automations,
    can_flow = EXCLUDED.can_flow,
    can_social_media = EXCLUDED.can_social_media,
    can_kanban = EXCLUDED.can_kanban,
    can_tickets = EXCLUDED.can_tickets,
    can_finance = EXCLUDED.can_finance,
    can_storage = EXCLUDED.can_storage,
    can_brands = EXCLUDED.can_brands,
    can_products = EXCLUDED.can_products,
    can_meta_connect = EXCLUDED.can_meta_connect,
    can_agents = EXCLUDED.can_agents,
    can_settings = EXCLUDED.can_settings,
    can_data_health = EXCLUDED.can_data_health,
    updated_at = now();

  DELETE FROM public.user_ad_account_access access
  WHERE access.user_id = _user_id AND access.workspace_id = _workspace_id;
  INSERT INTO public.user_ad_account_access (user_id, ad_account_id, workspace_id)
  SELECT _user_id, account.id, _workspace_id
  FROM public.ad_accounts account
  WHERE account.id = ANY(COALESCE(_ad_account_ids, '{}'::uuid[]))
    AND account.workspace_id = _workspace_id
  ON CONFLICT (user_id, ad_account_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;

  DELETE FROM public.user_rd_funnel_access access
  WHERE access.user_id = _user_id AND access.workspace_id = _workspace_id;
  INSERT INTO public.user_rd_funnel_access (user_id, rd_funnel_id, workspace_id)
  SELECT _user_id, funnel.id, _workspace_id
  FROM public.rd_funnels funnel
  WHERE funnel.id = ANY(COALESCE(_rd_funnel_ids, '{}'::uuid[]))
    AND funnel.workspace_id = _workspace_id
  ON CONFLICT (user_id, rd_funnel_id) DO UPDATE SET workspace_id = EXCLUDED.workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_workspace_user_access(
  _workspace_id uuid,
  _user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining integer;
BEGIN
  DELETE FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id;
  DELETE FROM public.workspace_user_permissions
  WHERE workspace_id = _workspace_id AND user_id = _user_id;
  DELETE FROM public.user_ad_account_access
  WHERE workspace_id = _workspace_id AND user_id = _user_id;
  DELETE FROM public.user_rd_funnel_access
  WHERE workspace_id = _workspace_id AND user_id = _user_id;

  SELECT count(*)::integer INTO _remaining
  FROM public.workspace_members
  WHERE user_id = _user_id AND status = 'active';
  IF _remaining = 0 THEN
    DELETE FROM public.user_permissions WHERE user_id = _user_id;
  END IF;
  RETURN _remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) TO service_role;

-- Kanban must require an active member, including legacy boards.
CREATE OR REPLACE FUNCTION public.can_access_kanban_workspace(_workspace_id text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _workspace_id = concat('legacy-', _user_id::text)
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members member
      WHERE member.workspace_id::text = _workspace_id
        AND member.user_id = _user_id
        AND member.status = 'active'
    );
$$;

-- Agents are visible to all active members but only editors/admins can mutate.
DROP POLICY IF EXISTS "Members manage intelligence agents" ON public.intelligence_agent_configs;
CREATE POLICY "Members view intelligence agents" ON public.intelligence_agent_configs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Editors manage intelligence agents" ON public.intelligence_agent_configs FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_workspace(workspace_id) AND owner_id = auth.uid());
CREATE POLICY "Editors update intelligence agents" ON public.intelligence_agent_configs FOR UPDATE TO authenticated
  USING (public.can_edit_workspace(workspace_id)) WITH CHECK (public.can_edit_workspace(workspace_id));
CREATE POLICY "Managers delete intelligence agents" ON public.intelligence_agent_configs FOR DELETE TO authenticated
  USING (public.can_manage_workspace(workspace_id));

DROP POLICY IF EXISTS "Members manage WhatsApp schedules" ON public.whatsapp_report_schedules;
CREATE POLICY "Members view WhatsApp schedules" ON public.whatsapp_report_schedules FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Editors create WhatsApp schedules" ON public.whatsapp_report_schedules FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_workspace(workspace_id) AND created_by = auth.uid());
CREATE POLICY "Managers update WhatsApp schedules" ON public.whatsapp_report_schedules FOR UPDATE TO authenticated
  USING (public.can_manage_workspace(workspace_id)) WITH CHECK (public.can_manage_workspace(workspace_id));
CREATE POLICY "Managers delete WhatsApp schedules" ON public.whatsapp_report_schedules FOR DELETE TO authenticated
  USING (public.can_manage_workspace(workspace_id));

-- Keep service-role integrations safe when a user is removed from a workspace.
COMMENT ON TABLE public.workspace_user_permissions IS 'Workspace-scoped permission catalog; user_permissions is retained only for legacy compatibility.';
