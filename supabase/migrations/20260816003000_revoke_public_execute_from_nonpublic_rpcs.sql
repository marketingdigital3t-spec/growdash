-- `PUBLIC` is a distinct PostgreSQL grantee (it includes anon). Explicitly
-- revoke it in addition to role-specific grants removed earlier. Authenticated
-- grants used by RLS remain intact.
REVOKE ALL ON FUNCTION public.can_access_kanban_workspace(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_workspace_object(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_workspace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_edit_workspace_object(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_finance(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_workspace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_current_workspace() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_master(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_ad(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_access_campaign(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_view_ad(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_view_ad_account(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_can_view_campaign(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_page(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_owns_ad_account(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_financial_document_history(uuid, uuid[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_company_from_ad_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_event_class_members_from_rd(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_rd_deal_to_canonical_sale() FROM PUBLIC;

-- The three intentionally anonymous RPCs are capability links. They are kept
-- explicit rather than inheriting broad PUBLIC execution.
REVOKE ALL ON FUNCTION public.get_public_finance_invoice_form(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_finance_invoice_form(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_public_finance_invoice_form(uuid, text, text, text, text, text, text, text, numeric, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_finance_invoice_form(uuid, text, text, text, text, text, text, text, numeric, text, text, text, text) TO anon, authenticated;
