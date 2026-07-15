/* Generated Supabase types are refreshed only after the additive migration is applied. */
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

export interface SalesGoal {
  id: string;
  workspace_id: string;
  business_unit_id: string;
  ad_account_id: string;
  goal_month: string;
  target_revenue: number;
  created_by: string | null;
  updated_at: string;
}

function isPendingSchema(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /sales_goals|schema cache|does not exist/i.test(error.message ?? ""));
}

export function useSalesGoals(month: Date = new Date()) {
  const { data: workspace } = useWorkspace();
  const { businessUnitId } = useGlobalFilters();
  const goalMonth = format(startOfMonth(month), "yyyy-MM-dd");
  const ready = !!workspace?.id && !workspace.id.startsWith("legacy-") && !!businessUnitId && !businessUnitId.startsWith("legacy-");

  return useQuery({
    queryKey: ["sales-goals", workspace?.id, businessUnitId, goalMonth],
    enabled: !!workspace?.id && !!businessUnitId,
    staleTime: 30_000,
    queryFn: async (): Promise<{ rows: SalesGoal[]; schemaReady: boolean }> => {
      if (!ready) return { rows: [], schemaReady: false };
      const { data, error } = await (supabase as any)
        .from("sales_goals")
        .select("id,workspace_id,business_unit_id,ad_account_id,goal_month,target_revenue,created_by,updated_at")
        .eq("workspace_id", workspace!.id)
        .eq("business_unit_id", businessUnitId)
        .eq("goal_month", goalMonth);
      if (error) {
        if (isPendingSchema(error)) return { rows: [], schemaReady: false };
        throw error;
      }
      return { rows: (data ?? []).map((row: SalesGoal) => ({ ...row, target_revenue: Number(row.target_revenue) })), schemaReady: true };
    },
  });
}
