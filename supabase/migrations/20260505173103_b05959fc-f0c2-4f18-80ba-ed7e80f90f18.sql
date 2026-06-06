
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS target_cpl numeric,
  ADD COLUMN IF NOT EXISTS min_spend_threshold numeric NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS public.campaign_targets (
  campaign_id text PRIMARY KEY REFERENCES public.campaigns(id) ON DELETE CASCADE,
  target_cpl numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaign_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View campaign targets" ON public.campaign_targets FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Insert campaign targets" ON public.campaign_targets FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Update campaign targets" ON public.campaign_targets FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Delete campaign targets" ON public.campaign_targets FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
CREATE TRIGGER update_campaign_targets_updated_at BEFORE UPDATE ON public.campaign_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.campaign_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_type text NOT NULL,
  field text,
  old_value text,
  new_value text,
  note text,
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_campaign_changes_campaign ON public.campaign_changes(campaign_id, changed_at DESC);
ALTER TABLE public.campaign_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View campaign changes" ON public.campaign_changes FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Insert campaign changes" ON public.campaign_changes FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));
CREATE POLICY "Delete campaign changes" ON public.campaign_changes FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR user_can_access_campaign(auth.uid(), campaign_id));

CREATE TABLE IF NOT EXISTS public.account_balance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  event_at timestamptz NOT NULL DEFAULT now(),
  delta numeric NOT NULL,
  new_balance numeric,
  source text NOT NULL DEFAULT 'meta_sync'
);
CREATE INDEX IF NOT EXISTS idx_balance_events_account ON public.account_balance_events(ad_account_id, event_at DESC);
ALTER TABLE public.account_balance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View balance events" ON public.account_balance_events FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
CREATE POLICY "Insert balance events" ON public.account_balance_events FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));
