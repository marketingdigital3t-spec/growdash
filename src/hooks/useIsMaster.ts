import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { withRequestTimeout } from "@/lib/resilience";

export function useIsMaster() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_master", user?.id],
    enabled: !!user,
    retry: false,
    staleTime: 30 * 60_000,
    gcTime: 24 * 60 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      try {
        const { data, error } = await withRequestTimeout(
          supabase.rpc("is_master", {
            _user_id: user!.id,
          }),
        );
        if (error) throw error;
        return data === true;
      } catch (err) {
        console.warn("Failsafe is_master query loaded:", err);
        return false;
      }
    },
  });
}
