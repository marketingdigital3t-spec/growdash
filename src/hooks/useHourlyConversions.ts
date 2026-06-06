import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { useDashboard } from "@/contexts/DashboardContext";

export interface HourlyRow {
  ad_account_id: string;
  campaign_id: string | null;
  ad_id: string;
  date: string;
  hour: number;
  leads: number;
  clicks: number;
  spend: number;
}

export const WEEKDAY_LABELS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function useHourlyConversions() {
  const { startDate, endDate, adAccountId, campaigns } = useDashboard() as any;
  // selectedCampaignIds is not in context — caller filters by ad_account scope
  const start = format(startDate, "yyyy-MM-dd");
  const end = format(endDate, "yyyy-MM-dd");

  const query = useQuery({
    queryKey: ["insights_hourly", adAccountId ?? "all", start, end],
    queryFn: async () => {
      let q = supabase
        .from("insights_hourly")
        .select("ad_account_id,campaign_id,ad_id,date,hour,leads,clicks,spend")
        .gte("date", start)
        .lte("date", end);
      if (adAccountId) q = q.eq("ad_account_id", adAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as HourlyRow[];
    },
  });

  const data = query.data || [];

  const aggregates = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, leads: 0 }));
    let manha = 0, tarde = 0, noite = 0;
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({ weekday: i, label: WEEKDAY_LABELS[i], short: WEEKDAY_SHORT[i], leads: 0 }));
    for (const r of data) {
      const leads = Number(r.leads || 0);
      byHour[r.hour].leads += leads;
      if (r.hour >= 6 && r.hour < 12) manha += leads;
      else if (r.hour >= 12 && r.hour < 18) tarde += leads;
      else noite += leads;
      // weekday — segunda=0 ... domingo=6
      const d = parseISO(r.date);
      const js = d.getDay(); // 0=Dom..6=Sab
      const idx = js === 0 ? 6 : js - 1;
      byWeekday[idx].leads += leads;
    }
    const total = manha + tarde + noite;
    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
    return {
      byHour,
      byWeekday,
      byPeriod: {
        manha: { leads: manha, pct: pct(manha) },
        tarde: { leads: tarde, pct: pct(tarde) },
        noite: { leads: noite, pct: pct(noite) },
        total,
      },
    };
  }, [data]);

  return { ...aggregates, isLoading: query.isLoading };
}
