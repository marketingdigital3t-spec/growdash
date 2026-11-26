-- RD pipelines are first-class CRM scopes and can be linked through an RD
-- connection without being attached to a Meta ad account. Stages belong to
-- the RD funnel; requiring ad_account_id made every stage sync fail for that
-- supported linkage mode (including the persisted-deal fallback).
ALTER TABLE public.rd_funnel_stages
  ALTER COLUMN ad_account_id DROP NOT NULL;

COMMENT ON COLUMN public.rd_funnel_stages.ad_account_id IS
  'Optional legacy Meta-account scope. RD-connected funnels may have no Meta account; RLS uses the parent funnel owner/access mapping.';
