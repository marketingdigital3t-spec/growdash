-- The RD mirror is read by funnel, date and current-stage scopes. Keep those
-- reads index-backed so a large historical snapshot cannot turn a temporary
-- PostgREST delay into an apparent zero in the UI.
CREATE INDEX IF NOT EXISTS rd_deals_funnel_stage_created_idx
  ON public.rd_deals (rd_funnel_id, stage_updated_at DESC NULLS LAST, lead_created_at DESC NULLS LAST, rd_deal_id);

CREATE INDEX IF NOT EXISTS rd_deals_funnel_closed_idx
  ON public.rd_deals (rd_funnel_id, closed_at DESC NULLS LAST, rd_deal_id)
  WHERE closed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS rd_deals_funnel_created_idx
  ON public.rd_deals (rd_funnel_id, lead_created_at DESC NULLS LAST, rd_deal_id);

CREATE INDEX IF NOT EXISTS rd_deals_unlinked_account_stage_idx
  ON public.rd_deals (ad_account_id, stage_updated_at DESC NULLS LAST, lead_created_at DESC NULLS LAST, rd_deal_id)
  WHERE rd_funnel_id IS NULL;

COMMENT ON INDEX public.rd_deals_funnel_stage_created_idx IS
  'Supports the read-only RD CRM mirror by linked funnel, current stage and lead creation time.';
