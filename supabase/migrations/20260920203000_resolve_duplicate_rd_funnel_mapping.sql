-- Keep one active local mapping per user's RD pipeline. The duplicate
-- Nathalia mapping was audited and the ee3c1763 account is the canonical one.
UPDATE public.rd_funnels
SET is_active = false,
    updated_at = now()
WHERE id = '752149cf-796e-4a65-ac84-4964fb98c175'
  AND user_id = '18dd6ba7-0acd-421e-881d-7d14fc654dc9'
  AND rd_funnel_id = '6a99c43d8dc539002e2bf284';

CREATE UNIQUE INDEX IF NOT EXISTS rd_funnels_active_user_rd_pipeline_uidx
  ON public.rd_funnels (user_id, rd_funnel_id)
  WHERE is_active = true AND rd_funnel_id IS NOT NULL;
