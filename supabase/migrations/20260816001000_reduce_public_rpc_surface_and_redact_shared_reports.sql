-- Authorization helpers are consumed by RLS policies. They are not public
-- endpoints and must not be callable without a Supabase session.
REVOKE ALL ON FUNCTION public.can_access_kanban_workspace(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_access_workspace_object(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_edit_workspace_object(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_finance(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.can_manage_workspace(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_current_workspace() FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE ALL ON FUNCTION public.is_master(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_platform_owner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_can_access_ad(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.user_can_access_campaign(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.user_can_view_ad(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.user_can_view_ad_account(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.user_can_view_campaign(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.user_has_page(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.user_owns_ad_account(uuid, uuid) FROM anon;

-- These are trigger/server-side synchronization helpers, not client RPCs.
REVOKE ALL ON FUNCTION public.sync_company_from_ad_account() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_event_class_members_from_rd(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_rd_deal_to_canonical_sale() FROM anon, authenticated;

-- Strip direct identifiers at every nesting level before a report accessed by
-- a bearer link is returned. This is deliberately conservative: aggregate
-- metrics remain available, while lead/contact records do not leave the
-- workspace through a shared link.
CREATE OR REPLACE FUNCTION public.redact_shared_report_payload(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT CASE jsonb_typeof(p_payload)
    WHEN 'object' THEN COALESCE((
      SELECT jsonb_object_agg(entry.key, public.redact_shared_report_payload(entry.value))
      FROM jsonb_each(p_payload) AS entry(key, value)
      WHERE lower(entry.key) NOT IN (
        'user_id', 'workspace_id', 'email', 'phone', 'telephone', 'mobile',
        'name', 'full_name', 'contact', 'contacts', 'lead', 'leads',
        'document', 'cpf', 'cnpj', 'address', 'street', 'postal_code'
      )
    ), '{}'::jsonb)
    WHEN 'array' THEN COALESCE((
      SELECT jsonb_agg(public.redact_shared_report_payload(item.value))
      FROM jsonb_array_elements(p_payload) AS item(value)
    ), '[]'::jsonb)
    ELSE p_payload
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_lead_report(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headers jsonb := '{}'::jsonb;
  v_client_fingerprint text;
  v_window_start timestamptz;
  v_hits integer;
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', report.id,
    'title', report.title,
    'account_id', report.account_id,
    'account_name', report.account_name,
    'date_from', report.date_from,
    'date_to', report.date_to,
    'metrics', report.metrics,
    'payload', public.redact_shared_report_payload(COALESCE(report.payload, '{}'::jsonb))
  ) INTO v_result
  FROM public.lead_report_pages report
  WHERE report.share_token = p_token
    AND report.is_public = true
    AND (report.expires_at IS NULL OR report.expires_at > now())
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    v_headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN others THEN
    v_headers := '{}'::jsonb;
  END;

  v_client_fingerprint := md5(COALESCE(
    v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', 'unknown'
  ));
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / 300) * 300);

  DELETE FROM public.lead_report_share_rate_limits WHERE updated_at < now() - interval '1 hour';

  INSERT INTO public.lead_report_share_rate_limits(share_token, client_fingerprint, window_start)
  VALUES (p_token, v_client_fingerprint, v_window_start)
  ON CONFLICT (share_token, client_fingerprint, window_start)
  DO UPDATE SET hit_count = public.lead_report_share_rate_limits.hit_count + 1, updated_at = now()
  RETURNING hit_count INTO v_hits;

  IF v_hits > 60 THEN
    RAISE EXCEPTION 'shared_report_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.redact_shared_report_payload(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_shared_lead_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_lead_report(uuid) TO anon, authenticated;
