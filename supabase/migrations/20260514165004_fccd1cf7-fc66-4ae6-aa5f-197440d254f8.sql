CREATE TABLE public.account_lead_action (
  ad_account_id uuid PRIMARY KEY REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  lp_lead_action text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_lead_action ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View account lead action"
ON public.account_lead_action FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Insert account lead action"
ON public.account_lead_action FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Update account lead action"
ON public.account_lead_action FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE POLICY "Delete account lead action"
ON public.account_lead_action FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR user_owns_ad_account(auth.uid(), ad_account_id));

CREATE TRIGGER update_account_lead_action_updated_at
BEFORE UPDATE ON public.account_lead_action
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();