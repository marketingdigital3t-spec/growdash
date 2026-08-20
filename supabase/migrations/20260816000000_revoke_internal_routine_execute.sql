-- Internal routines are invoked by triggers or trusted server-side code only.
-- Supabase grants EXECUTE to anon/authenticated by default, so revoking PUBLIC
-- alone is insufficient when those explicit grants pre-date this migration.

REVOKE ALL ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_workspace_user_access(uuid, uuid, text, text, jsonb, uuid[], uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_remove_workspace_user_access(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.apply_rd_deal_effective_amount() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.capture_rd_deal_stage_history() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
