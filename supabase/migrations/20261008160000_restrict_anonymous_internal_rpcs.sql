-- Keep only the intentionally public token-based forms callable without a
-- session. Internal authorization, synchronization and attribution helpers
-- must not be reachable through the anonymous PostgREST role.
REVOKE EXECUTE ON FUNCTION public.acquire_realtime_sync_lock(uuid, text, text, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_current_workspace_memberships() FROM anon;
REVOKE EXECUTE ON FUNCTION public.agent_office_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_rd_deal_to_meta_form_lead() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_zero_value_rd_sale() FROM anon;
REVOKE EXECUTE ON FUNCTION public.propagate_meta_form_attribution_to_sale() FROM anon;
REVOKE EXECUTE ON FUNCTION public.reconcile_meta_form_lead_arrival() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_growdash_questionnaire_experts(uuid) FROM anon;

-- The public questionnaire, diagnostic and shared-report RPCs are omitted on
-- purpose: they authenticate the request with a single-use/share token.
