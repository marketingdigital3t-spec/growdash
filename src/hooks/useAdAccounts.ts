import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdAccounts(options?: { refetchIntervalMs?: number }) {
  return useQuery({
    queryKey: ["ad_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_accounts")
        .select("id, account_id, name, created_at, daily_budget, remaining_balance, target_cpl, min_spend_threshold, connection_status, last_sync_error, last_sync_error_code, last_sync_attempt_at, last_sync_success_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: options?.refetchIntervalMs,
  });
}
