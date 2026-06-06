
CREATE TABLE public.meta_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id uuid NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  form_id text,
  meta_lead_id text NOT NULL UNIQUE,
  created_time timestamptz NOT NULL,
  field_data jsonb,
  email text,
  phone text,
  full_name text,
  lead_state text,
  lead_city text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meta_leads_acc_time ON public.meta_leads (ad_account_id, created_time DESC);
CREATE INDEX idx_meta_leads_ad ON public.meta_leads (ad_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_leads TO authenticated;
GRANT ALL ON public.meta_leads TO service_role;

ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View meta_leads"
ON public.meta_leads FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_can_view_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert meta_leads"
ON public.meta_leads FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Update meta_leads"
ON public.meta_leads FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete meta_leads"
ON public.meta_leads FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
