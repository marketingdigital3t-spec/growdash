import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { selectPrimaryRDIntegration } from "@/lib/rdIntegrationConnection";

export function useRDIntegration() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["integration", "rd_station_crm", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rd_account_connections")
        .select("id, status, write_enabled, external_account_id, created_at, updated_at, last_success_at, last_error")
        .eq("user_id", user!.id)
        // Do not select by updated_at: sync workers update that timestamp on
        // different accounts and would make the write toggle jump connections
        // between reloads. The stable owner-level row is selected below.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) throw error;
      const connection = selectPrimaryRDIntegration(data ?? []);
      return connection ? { ...connection, provider: "rd_station_crm", is_active: connection.status === "connected" } : null;
    },
  });
}
