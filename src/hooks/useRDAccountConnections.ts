import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";

export type RDAccountConnection = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  external_account_id: string | null;
  account_name: string;
  status: "pending" | "connected" | "blocked" | "partial" | "failed";
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  permissions: unknown[];
  created_at: string;
  updated_at: string;
};

export function useRDAccountConnections() {
  const { user } = useAuth();
  return useQuery<RDAccountConnection[]>({
    queryKey: ["rd_account_connections", user?.id],
    enabled: !!user,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        (supabase as any).from("rd_account_connections")
          .select("id,user_id,workspace_id,external_account_id,account_name,status,last_attempt_at,last_success_at,last_error,permissions,created_at,updated_at")
          .order("account_name", { ascending: true }),
        12_000,
      );
      if (error) throw error;
      return (data ?? []) as RDAccountConnection[];
    },
  });
}

export function useInvalidateRDAccountConnections() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["rd_account_connections"] });
}
