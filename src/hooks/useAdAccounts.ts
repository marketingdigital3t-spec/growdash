import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdAccounts() {
  return useQuery({
    queryKey: ["ad_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at, workspace_id, business_unit_id")
        .order("created_at", { ascending: false });
      if (!error) return data;
      if (!/workspace_id|business_unit_id|schema cache/i.test(error.message)) throw error;
      const legacy = await supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at")
        .order("created_at", { ascending: false });
      if (legacy.error) throw legacy.error;
      return (legacy.data ?? []).map((account) => ({ ...account, workspace_id: null, business_unit_id: "legacy-infoproduto" }));
    },
  });
}
