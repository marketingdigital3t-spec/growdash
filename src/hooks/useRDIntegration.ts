import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { selectPrimaryRDIntegration } from "@/lib/rdIntegrationConnection";
import { withRequestTimeout } from "@/lib/resilience";
import { readLocalCache, writeLocalCache } from "@/lib/localCache";

export type RDIntegrationSummary = {
  id: string;
  provider: "rd_station_crm";
  status: string;
  is_active: boolean;
  write_enabled?: boolean;
  external_account_id?: string;
  created_at?: string;
  updated_at?: string;
  last_success_at?: string | null;
  last_error?: string | null;
};

export function useRDIntegration() {
  const { user } = useAuth();
  const cacheKey = user?.id ? `growdash:rd-integration:${user.id}` : "";

  return useQuery<RDIntegrationSummary | null>({
    queryKey: ["integration", "rd_station_crm", user?.id],
    enabled: !!user,
    retry: 1,
    retryDelay: 1_000,
    staleTime: 2 * 60_000,
    refetchOnReconnect: true,
    placeholderData: readLocalCache<RDIntegrationSummary>(cacheKey),
    queryFn: async () => {
      const { data, error } = await withRequestTimeout<any>((supabase as any)
        .from("rd_account_connections")
        .select("id, status, write_enabled, external_account_id, created_at, updated_at, last_success_at, last_error")
        .eq("user_id", user!.id)
        // Do not select by updated_at: sync workers update that timestamp on
        // different accounts and would make the write toggle jump connections
        // between reloads. The stable owner-level row is selected below.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }), 12_000);
      if (error) throw error;
      const connection = selectPrimaryRDIntegration<any>(data ?? []);
      const result = connection ? {
        ...connection,
        provider: "rd_station_crm" as const,
        is_active: connection.status === "connected",
        updated_at: connection.updated_at ?? undefined,
        last_success_at: connection.last_success_at ?? null,
        last_error: connection.last_error ?? null,
      } : null;
      if (result) writeLocalCache(cacheKey, result);
      return result;
    },
  });
}
