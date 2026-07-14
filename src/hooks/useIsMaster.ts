import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsMaster() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_master", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "master")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}
