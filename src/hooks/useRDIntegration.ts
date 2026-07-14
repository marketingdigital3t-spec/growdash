import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useRDIntegration() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["integration", "rd_station_crm", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, provider, is_active, created_at, updated_at")
        .eq("user_id", user!.id)
        .eq("provider", "rd_station_crm")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
