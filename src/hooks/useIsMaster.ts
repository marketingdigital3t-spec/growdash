import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsMaster() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is_master", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // A função do banco também reconhece o proprietário da plataforma pelo
      // e-mail oficial. Consultar apenas user_roles fazia o dono autenticar e
      // ser imediatamente redirecionado de volta para /auth.
      const { data, error } = await supabase.rpc("is_master", {
        _user_id: user!.id,
      });
      if (error) throw error;
      return data === true;
    },
  });
}
