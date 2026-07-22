import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAlerts(onlyUnread = false) {
  return useQuery({
    queryKey: ["alerts", onlyUnread],
    queryFn: async () => {
      let query = (supabase as any)
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (onlyUnread) {
        query = query.eq("is_read", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await (supabase as any)
        .from("alerts")
        .update({ is_read: true })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
