-- Persistent mapping between a Meta Lead Ads form and the ad account whose
-- token can read its leads.  Meta webhooks identify a lead by form/page
-- before our local ads catalog necessarily contains the new ad, so this
-- catalog is the stable routing contract for real-time intake.
CREATE TABLE IF NOT EXISTS public.meta_lead_form_catalog (
  form_id text PRIMARY KEY,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  page_id text,
  name text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS meta_lead_form_catalog_account_idx
  ON public.meta_lead_form_catalog (ad_account_id, last_seen_at DESC);

ALTER TABLE public.meta_lead_form_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_lead_form_catalog FROM PUBLIC;
GRANT ALL ON public.meta_lead_form_catalog TO service_role;

COMMENT ON TABLE public.meta_lead_form_catalog IS
  'Server-side routing catalog: Meta Lead Ads form_id to the Growdash ad account token.';
