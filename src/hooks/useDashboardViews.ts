import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardView {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  is_system: boolean;
  scope: string;
  ad_account_id: string | null;
  layout: any[];
  widgets: any[];
  created_at: string;
  updated_at: string;
}

export function useGlobalView() {
  return useQuery({
    queryKey: ["dashboard_view_global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_views")
        .select("*")
        .eq("scope", "global")
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as DashboardView | null) ?? null;
    },
  });
}

export function useSaveView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, layout, widgets }: { id: string; layout: any[]; widgets: any[] }) => {
      const { error } = await supabase
        .from("dashboard_views")
        .update({ layout, widgets, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard_view_global"] }),
  });
}
