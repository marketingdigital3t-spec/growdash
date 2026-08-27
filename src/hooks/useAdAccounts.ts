import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";

export function useAdAccounts(includeDisconnected = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ad_accounts", user?.id ?? "anonymous", includeDisconnected],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at, workspace_id, business_unit_id, timezone_name, timezone_offset_hours_utc, attribution_window, oauth_health_status, oauth_checked_at, oauth_permissions")
        .order("created_at", { ascending: false }), 12_000);
      if (!error) return includeDisconnected ? data : (data ?? []).filter((account) => account.connection_status !== "disconnected");
      if (!/workspace_id|business_unit_id|schema cache/i.test(error.message)) throw error;
      const legacy = await withRequestTimeout(supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at")
        .order("created_at", { ascending: false }), 12_000);
      if (legacy.error) throw legacy.error;
      const normalized = (legacy.data ?? []).map((account) => ({ ...account, workspace_id: null, business_unit_id: "legacy-infoproduto", timezone_name: "America/Sao_Paulo", timezone_offset_hours_utc: -3, attribution_window: "account_default", oauth_health_status: "unchecked", oauth_checked_at: null, oauth_permissions: [] }));
      return includeDisconnected ? normalized : normalized.filter((account) => account.connection_status !== "disconnected");
    },
  });
}
