import { useMutation } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, addMonths, format, isAfter } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface BackfillParams {
  /** Inclusive start. Defaults to Jan 1 of current year. */
  from?: Date;
  /** Inclusive end. Defaults to today. */
  to?: Date;
  /** Optional account scope. Defaults to all accounts. */
  adAccountId?: string;
}

interface MonthResult {
  month: string;
  synced: number;
  error?: string;
}

/**
 * Runs `sync-meta-insights` month-by-month from `from` to `to`.
 * Splitting into monthly chunks avoids Meta's row caps with `time_increment=1`.
 * Reports per-month progress via toast; surfaces final summary.
 */
export function useBackfillMeta() {
  return useMutation({
    mutationFn: async (params: BackfillParams = {}) => {
      const today = new Date();
      const from = params.from ?? new Date(today.getFullYear(), 0, 1);
      const to = params.to ?? today;
      const results: MonthResult[] = [];

      let cursor = startOfMonth(from);
      const finalEnd = endOfMonth(to);
      const totalMonths =
        (finalEnd.getFullYear() - cursor.getFullYear()) * 12 +
        (finalEnd.getMonth() - cursor.getMonth()) +
        1;
      let idx = 0;

      while (!isAfter(cursor, finalEnd)) {
        idx += 1;
        const monthStart = cursor;
        const rawMonthEnd = endOfMonth(cursor);
        const monthEnd = isAfter(rawMonthEnd, to) ? to : rawMonthEnd;
        const startStr = format(monthStart, "yyyy-MM-dd");
        const endStr = format(monthEnd, "yyyy-MM-dd");
        const label = format(monthStart, "MM/yyyy");

        const tId = toast.loading(`Backfill ${label} (${idx}/${totalMonths})…`);
        try {
          const [insightsRes, hourlyRes] = await Promise.all([
            supabase.functions.invoke("sync-meta-insights", {
              body: { adAccountId: params.adAccountId, startDate: startStr, endDate: endStr },
            }),
            supabase.functions.invoke("sync-meta-hourly", {
              body: { adAccountId: params.adAccountId, startDate: startStr, endDate: endStr },
            }),
          ]);
          if (insightsRes.error) throw insightsRes.error;
          if (insightsRes.data?.error && !insightsRes.data?.success) throw new Error(insightsRes.data.error);
          const synced = Number(insightsRes.data?.synced ?? 0) + Number(hourlyRes.data?.synced ?? 0);
          results.push({ month: label, synced });
          toast.success(`${label}: ${synced} registros`, { id: tId });
        } catch (e) {
          results.push({ month: label, synced: 0, error: (e as Error).message });
          toast.error(`${label} falhou`, { id: tId, description: (e as Error).message });
        }

        cursor = addMonths(cursor, 1);
      }

      return results;
    },
    onSuccess: (results) => {
      const total = results.reduce((s, r) => s + r.synced, 0);
      const failed = results.filter((r) => r.error);
      toast.success(`Backfill concluído — ${total} registros em ${results.length} meses`, {
        description:
          failed.length > 0
            ? `${failed.length} mês(es) com erro: ${failed.map((f) => f.month).join(", ")}`
            : undefined,
      });
    },
    onError: (e) => {
      toast.error("Erro no backfill", { description: (e as Error).message });
    },
  });
}
