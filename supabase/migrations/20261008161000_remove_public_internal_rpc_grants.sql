-- REVOKE from PUBLIC is required here because PostgreSQL's PUBLIC role grant
-- also covers the anonymous role. Keep policy helpers available to signed-in
-- requests, while trigger-only functions need no client EXECUTE privilege.
REVOKE ALL ON FUNCTION public.agent_office_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agent_office_owner(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_workspace_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_owner(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.link_rd_deal_to_meta_form_lead() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_zero_value_rd_sale() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.propagate_meta_form_attribution_to_sale() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_meta_form_lead_arrival() FROM PUBLIC;
