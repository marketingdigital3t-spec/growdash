import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_VIEW } from "@/lib/widgetCatalog";
import { ensureDefaultDashboardContent } from "@/lib/dashboardViewDefaults";

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

export const FALLBACK_DASHBOARD_VIEW_ID = "__fallback_dashboard_view";

const fallbackGlobalView: DashboardView = {
  id: FALLBACK_DASHBOARD_VIEW_ID,
  user_id: "",
  name: DEFAULT_VIEW.name,
  is_default: true,
  is_system: true,
  scope: "global",
  ad_account_id: null,
  layout: DEFAULT_VIEW.layout,
  widgets: DEFAULT_VIEW.widgets,
  created_at: "",
  updated_at: "",
};

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
      if (error) {
        console.warn("Não foi possível carregar a visualização do dashboard; usando o layout padrão.", error);
        return fallbackGlobalView;
      }
      return ensureDefaultDashboardContent((data as DashboardView | null) ?? fallbackGlobalView);
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
