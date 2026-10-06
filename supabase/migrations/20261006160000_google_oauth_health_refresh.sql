ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS token_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_refresh_source text;

ALTER TABLE public.oauth_health_events DROP CONSTRAINT IF EXISTS oauth_health_events_status_check;
ALTER TABLE public.oauth_health_events
  ADD CONSTRAINT oauth_health_events_status_check
  CHECK (status IN ('healthy','expiring','expired','permission_removed','error','reauthorization_required','unchecked'));

GRANT SELECT (token_refreshed_at, token_refresh_source) ON public.integrations TO authenticated;
CREATE INDEX IF NOT EXISTS integrations_google_health_idx
  ON public.integrations(provider, is_active, token_expires_at)
  WHERE provider = 'google_workspace' AND is_active = true;
