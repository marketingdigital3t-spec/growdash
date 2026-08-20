-- Security/LGPD hardening:
-- 1. Internal SECURITY DEFINER routines must never be callable by anonymous
--    clients. Triggers and Edge Functions run as privileged database roles and
--    do not require PUBLIC execute privileges.
-- 2. Public report links must rate limit only valid, active bearer links. The
--    former implementation could fail with an ambiguous PL/pgSQL identifier
--    and created rate-limit rows even for random, invalid tokens.
-- 3. Pin pure helper functions to a predictable search_path so a role's
--    mutable schema path cannot affect their execution.

REVOKE ALL ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_rd_deal_effective_amount() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.capture_rd_deal_stage_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;

ALTER FUNCTION public.set_rd_deal_effective_amount() SET search_path = pg_catalog, public;
ALTER FUNCTION public.growdash_normalize_key(text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.event_class_region(text, text) SET search_path = pg_catalog, public;
ALTER FUNCTION public.rd_deal_region(text) SET search_path = pg_catalog, public;

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
  -- Check the token before writing a rate-limit row. This avoids turning a
  -- public RPC endpoint into unbounded storage for random UUID guesses.
  SELECT jsonb_build_object(
    'id', report.id,
    'title', report.title,
    'account_id', report.account_id,
    'account_name', report.account_name,
    'date_from', report.date_from,
    'date_to', report.date_to,
    'metrics', report.metrics,
    -- Public reports are intentionally aggregate-only. Remove common direct
    -- identifiers from the shared payload before it leaves the workspace.
    'payload', COALESCE(report.payload, '{}'::jsonb)
      - ARRAY['user_id','workspace_id','email','phone','telephone','mobile','name','full_name','contact','contacts','lead','leads']
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
    v_headers->>'cf-connecting-ip',
    v_headers->>'x-forwarded-for',
    'unknown'
  ));
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / 300) * 300);

  DELETE FROM public.lead_report_share_rate_limits
  WHERE updated_at < now() - interval '1 hour';

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

REVOKE ALL ON FUNCTION public.get_shared_lead_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_lead_report(uuid) TO anon, authenticated;
