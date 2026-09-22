import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useRDIntegration() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["integration", "rd_station_crm", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rd_account_connections")
        .select("id, status, created_at, updated_at, last_success_at, last_error")
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, provider: "rd_station_crm", is_active: data.status === "connected" } : null;
    },
  });
}
