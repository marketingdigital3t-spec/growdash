-- Lightweight token/fingerprint rate limit for public report RPC calls.
CREATE TABLE IF NOT EXISTS public.lead_report_share_rate_limits (
  share_token uuid NOT NULL,
  client_fingerprint text NOT NULL,
  window_start timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_token, client_fingerprint, window_start)
);

REVOKE ALL ON public.lead_report_share_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.lead_report_share_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.get_shared_lead_report(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_headers jsonb := '{}'::jsonb;
  client_fingerprint text;
  window_start timestamptz;
  hits integer;
  result jsonb;
BEGIN
  BEGIN
    request_headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN others THEN
    request_headers := '{}'::jsonb;
  END;

  client_fingerprint := md5(COALESCE(
    request_headers->>'cf-connecting-ip',
    request_headers->>'x-forwarded-for',
    'unknown'
  ));
  window_start := to_timestamp(floor(extract(epoch FROM now()) / 300) * 300);

  DELETE FROM public.lead_report_share_rate_limits
  WHERE updated_at < now() - interval '1 hour';

  INSERT INTO public.lead_report_share_rate_limits(share_token, client_fingerprint, window_start)
  VALUES (p_token, client_fingerprint, window_start)
  ON CONFLICT (share_token, client_fingerprint, window_start)
  DO UPDATE SET hit_count = public.lead_report_share_rate_limits.hit_count + 1, updated_at = now()
  RETURNING hit_count INTO hits;

  IF hits > 60 THEN
    RAISE EXCEPTION 'shared_report_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'id', report.id,
    'title', report.title,
    'account_id', report.account_id,
    'account_name', report.account_name,
    'date_from', report.date_from,
    'date_to', report.date_to,
    'metrics', report.metrics,
    'payload', COALESCE(report.payload, '{}'::jsonb)
      - ARRAY['user_id','workspace_id','email','phone','telephone','mobile','name','full_name','contact','contacts','lead','leads']
  ) INTO result
  FROM public.lead_report_pages report
  WHERE report.share_token = p_token
    AND report.is_public = true
    AND (report.expires_at IS NULL OR report.expires_at > now())
  LIMIT 1;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_lead_report(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_lead_report(uuid) TO anon, authenticated;
