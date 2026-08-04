import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsMaster() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_master", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc("is_master", {
          _user_id: user!.id,
        });
        if (error) throw error;
        return data === true;
      } catch (err) {
        console.warn("Failsafe is_master query loaded:", err);
        return false;
      }
    },
  });
}
