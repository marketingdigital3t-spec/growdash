import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";

// Disconnected accounts remain visible so operators can reconnect them. Hiding
// them made a permissions outage look like destructive data loss.
export function useAdAccounts(includeDisconnected = true) {
  const { user } = useAuth();
  const cacheKey = user?.id ? `growdash:ad-accounts:${user.id}:${includeDisconnected ? "all" : "connected"}` : "";
  return useQuery({
    queryKey: ["ad_accounts", user?.id ?? "anonymous", includeDisconnected],
    enabled: !!user,
    retry: 3,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 5_000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at, workspace_id, business_unit_id, timezone_name, timezone_offset_hours_utc, attribution_window, oauth_health_status, oauth_checked_at, oauth_permissions")
        .order("created_at", { ascending: false }), 12_000);
      if (!error) {
        const result = includeDisconnected ? data : (data ?? []).filter((account) => account.connection_status !== "disconnected");
        try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(result ?? [])); } catch { /* cache is optional */ }
        return result;
      }
      if (!/workspace_id|business_unit_id|schema cache/i.test(error.message)) throw error;
      const legacy = await withRequestTimeout(supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at")
        .order("created_at", { ascending: false }), 12_000);
      if (legacy.error) throw legacy.error;
      const normalized = (legacy.data ?? []).map((account) => ({ ...account, workspace_id: null, business_unit_id: "legacy-infoproduto", timezone_name: "America/Sao_Paulo", timezone_offset_hours_utc: -3, attribution_window: "account_default", oauth_health_status: "unchecked", oauth_checked_at: null, oauth_permissions: [] }));
      const result = includeDisconnected ? normalized : normalized.filter((account) => account.connection_status !== "disconnected");
      try { if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* cache is optional */ }
      return result;
    },
  });
}
