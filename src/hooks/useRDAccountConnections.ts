import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";
import { readLocalCache, writeLocalCache } from "@/lib/localCache";

export type RDAccountConnection = {
  id: string;
  user_id?: string;
  workspace_id: string | null;
  external_account_id: string | null;
  account_name: string;
  status: "pending" | "connected" | "blocked" | "partial" | "failed";
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  permissions: unknown[];
  write_enabled: boolean;
  write_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useRDAccountConnections(workspaceId?: string, options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const cacheKey = user?.id ? `growdash:rd-connections:${user.id}:${workspaceId ?? "owner-only"}` : "";
  return useQuery<RDAccountConnection[]>({
    queryKey: ["rd_account_connections", user?.id, workspaceId ?? "owner-only"],
    enabled: (options?.enabled ?? true) && !!user,
    retry: 1,
    retryDelay: 1_000,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60_000,
    placeholderData: readLocalCache<RDAccountConnection[]>(cacheKey),
    queryFn: async () => {
      if (workspaceId) {
        const { data, error } = await withRequestTimeout<{ data: RDAccountConnection[] | null; error: Error | null }>(
          (supabase as any).rpc("list_workspace_rd_account_connections", { _workspace_id: workspaceId }) as PromiseLike<{ data: RDAccountConnection[] | null; error: Error | null }>,
          12_000,
        );
        if (error) throw error;
        // The workspace RPC deliberately returns only IDs and display metadata;
        // never request or cache api_token in a member-visible query.
        const result = (data ?? []) as RDAccountConnection[];
        writeLocalCache(cacheKey, result);
        return result;
      }
      const { data, error } = await withRequestTimeout<{ data: RDAccountConnection[] | null; error: Error | null }>(
        (supabase as any).from("rd_account_connections")
          .select("id,user_id,workspace_id,external_account_id,account_name,status,last_attempt_at,last_success_at,last_error,permissions,write_enabled,write_updated_at,created_at,updated_at")
          .order("account_name", { ascending: true }) as PromiseLike<{ data: RDAccountConnection[] | null; error: Error | null }>,
        12_000,
      );
      if (error) throw error;
      const result = (data ?? []) as RDAccountConnection[];
      writeLocalCache(cacheKey, result);
      return result;
    },
  });
}

export function useInvalidateRDAccountConnections() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["rd_account_connections"] });
}
