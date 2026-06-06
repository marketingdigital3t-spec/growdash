import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformOwnerEmail } from "@/lib/platformOwner";

export function useIsMaster() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_master", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isPlatformOwnerEmail(user?.email)) return true;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .in("role", ["master", "admin"])
        .limit(1);
      if (error) throw error;
      return (data ?? []).length > 0;
    },
  });
}
