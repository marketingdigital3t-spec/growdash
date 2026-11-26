import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { selectPrimaryRDIntegration } from "@/lib/rdIntegrationConnection";
import { withRequestTimeout } from "@/lib/resilience";
import { readLocalCache, writeLocalCache } from "@/lib/localCache";

export type RDIntegrationSummary = {
  id: string;
  workspace_id?: string | null;
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
  const { data: workspace, isLoading: workspaceLoading } = useWorkspace();
  const cacheKey = user?.id ? `growdash:rd-integration:${user.id}` : "";

  return useQuery<RDIntegrationSummary | null>({
    queryKey: ["integration", "rd_station_crm", user?.id, workspace?.id ?? null],
    enabled: !!user && !workspaceLoading,
    retry: 1,
    retryDelay: 1_000,
    staleTime: 2 * 60_000,
    refetchOnReconnect: true,
    placeholderData: readLocalCache<RDIntegrationSummary>(cacheKey),
    queryFn: async () => {
      const request = workspace?.id
        ? (supabase as any).rpc("list_workspace_rd_account_connections", { _workspace_id: workspace.id })
        : (supabase as any)
          .from("rd_account_connections")
          .select("id, workspace_id, status, write_enabled, external_account_id, created_at, updated_at, last_success_at, last_error")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true });
      const { data, error } = await withRequestTimeout<any>(request, 12_000);
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
