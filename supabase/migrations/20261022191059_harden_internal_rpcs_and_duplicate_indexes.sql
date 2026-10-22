-- Revoke PostgreSQL's default PUBLIC EXECUTE from internal SECURITY DEFINER
-- routines. The explicit authenticated grants remain in place; token-based
-- public form RPCs are intentionally not changed here.
REVOKE ALL ON FUNCTION public.consume_workspace_usage(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_workspace_usage(uuid, text, numeric) TO authenticated;

REVOKE ALL ON FUNCTION public.get_workspace_access_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_access_state(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.record_legal_consent(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_legal_consent(text, text) TO authenticated;

-- Trigger-only functions must not be callable through PostgREST. They still
-- execute as the trigger owner when the protected table changes.
REVOKE ALL ON FUNCTION public.sync_expert_sale_from_rd_deal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_expert_sale_from_rd_deal() TO service_role;

REVOKE ALL ON FUNCTION public.traffic_proposal_requires_approval() FROM PUBLIC, anon, authenticated;

-- The second pair is byte-for-byte equivalent to the canonical indexes and
-- only adds write overhead. Keep the names used by the newer migrations.
DROP INDEX IF EXISTS public.insight_actions_account_date_window_idx;
DROP INDEX IF EXISTS public.insights_account_date_window_idx;
