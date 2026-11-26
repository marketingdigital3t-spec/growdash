-- Add scope column to differentiate native form vs landing page events per account
ALTER TABLE public.account_lead_action
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'landing_page';

ALTER TABLE public.account_lead_action
  DROP CONSTRAINT IF EXISTS account_lead_action_check_scope;
ALTER TABLE public.account_lead_action
  ADD CONSTRAINT account_lead_action_check_scope
  CHECK (scope IN ('native_form', 'landing_page'));

-- Replace primary key to include scope
ALTER TABLE public.account_lead_action
  DROP CONSTRAINT IF EXISTS account_lead_action_pkey;
ALTER TABLE public.account_lead_action
  ADD PRIMARY KEY (ad_account_id, scope, lp_lead_action);
