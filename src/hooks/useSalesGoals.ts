/* Generated Supabase types are refreshed only after the additive migration is applied. */
import { useQuery } from "@tanstack/react-query";
import { startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { businessDateKey } from "@/lib/businessDate";
import { resolveEffectiveSalesGoals } from "@/lib/monthlyGoal";

export interface SalesGoal {
  id: string;
  workspace_id: string;
  business_unit_id: string;
  ad_account_id: string;
  goal_month: string;
  target_revenue: number;
  created_by: string | null;
  updated_at: string;
  source_goal_month?: string;
  is_inherited?: boolean;
}

function isPendingSchema(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /sales_goals|schema cache|does not exist/i.test(error.message ?? ""));
}

interface UseSalesGoalsOptions {
  enabled?: boolean;
}

export function useSalesGoals(month: Date = new Date(), options: UseSalesGoalsOptions = {}) {
  const { data: workspace } = useWorkspace();
  const { businessUnitId } = useGlobalFilters();
  const goalMonth = `${businessDateKey(startOfMonth(month)).slice(0, 7)}-01`;
  const ready = !!workspace?.id && !workspace.id.startsWith("legacy-") && !!businessUnitId && !businessUnitId.startsWith("legacy-");

  return useQuery({
    queryKey: ["sales-goals", workspace?.id, businessUnitId, goalMonth],
    enabled: options.enabled !== false && !!workspace?.id && !!businessUnitId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ rows: SalesGoal[]; schemaReady: boolean }> => {
      if (!ready) return { rows: [], schemaReady: false };
      const { data, error } = await (supabase as any)
        .from("sales_goals")
        .select("id,workspace_id,business_unit_id,ad_account_id,goal_month,target_revenue,created_by,updated_at")
        .eq("workspace_id", workspace!.id)
        .eq("business_unit_id", businessUnitId)
        .lte("goal_month", goalMonth)
        .order("goal_month", { ascending: false });
      if (error) {
        if (isPendingSchema(error)) return { rows: [], schemaReady: false };
        throw error;
      }
      const rows = resolveEffectiveSalesGoals((data ?? []).map((row: SalesGoal) => ({ ...row, target_revenue: Number(row.target_revenue) })), goalMonth) as SalesGoal[];
      return { rows, schemaReady: true };
    },
  });
}
