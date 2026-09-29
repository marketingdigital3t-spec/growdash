-- RD funnels are independent integrations. Preserve every funnel and its
-- activation state, but remove the legacy Meta-account relationship.
UPDATE public.rd_funnels
SET ad_account_id = NULL,
    updated_at = now()
WHERE ad_account_id IS NOT NULL;

COMMENT ON COLUMN public.rd_funnels.ad_account_id IS
  'Deprecated legacy relationship. RD funnels are activated independently and are not scoped to Meta accounts.';
