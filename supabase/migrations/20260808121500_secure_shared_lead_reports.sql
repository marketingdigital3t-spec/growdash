-- Public report links are token-gated, revocable and time-limited.
ALTER TABLE public.lead_report_pages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.lead_report_pages
SET expires_at = COALESCE(expires_at, created_at + interval '30 days')
WHERE expires_at IS NULL;

ALTER TABLE public.lead_report_pages
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

CREATE INDEX IF NOT EXISTS lead_report_pages_share_expiry_idx
  ON public.lead_report_pages(share_token, expires_at)
  WHERE is_public = true;

CREATE OR REPLACE FUNCTION public.get_shared_lead_report(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', report.id,
    'title', report.title,
    'account_id', report.account_id,
    'account_name', report.account_name,
    'date_from', report.date_from,
    'date_to', report.date_to,
    'metrics', report.metrics,
    -- Remove common personal-data keys before exposing a public payload.
    'payload', COALESCE(report.payload, '{}'::jsonb)
      - ARRAY['user_id','workspace_id','email','phone','telephone','mobile','name','full_name','contact','contacts','lead','leads']
  )
  FROM public.lead_report_pages report
  WHERE report.share_token = p_token
    AND report.is_public = true
    AND (report.expires_at IS NULL OR report.expires_at > now())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_lead_report(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shared_lead_report(uuid) TO anon, authenticated;
