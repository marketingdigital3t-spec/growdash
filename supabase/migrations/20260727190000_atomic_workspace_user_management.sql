-- User management must either finish completely or leave the previous state intact.
-- These functions are intentionally service-role only and are called by the
-- admin-create-user Edge Function after it validates the current administrator.

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

  -- Remove only an orphaned legacy permission row that blocks this auth e-mail.
  DELETE FROM public.user_permissions
  WHERE lower(username) = lower(trim(_email))
    AND user_id <> _user_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (_workspace_id, _user_id, _role, 'active')
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active';

  INSERT INTO public.user_permissions (
    user_id, username, can_dashboard, can_campaigns, can_funnels, can_classes,
    can_crm, can_commercial, can_leads, can_alerts, can_users,
    can_integrations, can_announcements, can_automations
  )
  VALUES (
    _user_id,
    lower(trim(_email)),
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
    COALESCE((_permissions->>'can_automations')::boolean, false)
  )
  ON CONFLICT (user_id) DO UPDATE SET
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
    can_automations = EXCLUDED.can_automations;

  DELETE FROM public.user_ad_account_access WHERE user_id = _user_id;
  INSERT INTO public.user_ad_account_access (user_id, ad_account_id)
  SELECT _user_id, access_id.id
  FROM unnest(COALESCE(_ad_account_ids, '{}'::uuid[])) AS access_id(id)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.user_rd_funnel_access WHERE user_id = _user_id;
  INSERT INTO public.user_rd_funnel_access (user_id, rd_funnel_id)
  SELECT _user_id, access_id.id
  FROM unnest(COALESCE(_rd_funnel_ids, '{}'::uuid[])) AS access_id(id)
  ON CONFLICT DO NOTHING;
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

  SELECT count(*)::integer INTO _remaining
  FROM public.workspace_members
  WHERE user_id = _user_id AND status = 'active';

  IF _remaining = 0 THEN
    DELETE FROM public.user_ad_account_access WHERE user_id = _user_id;
    DELETE FROM public.user_rd_funnel_access WHERE user_id = _user_id;
    DELETE FROM public.user_permissions WHERE user_id = _user_id;
  END IF;

  RETURN _remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) TO service_role;
