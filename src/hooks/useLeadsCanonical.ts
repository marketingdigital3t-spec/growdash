import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseISO } from "date-fns";
import { useDashboard } from "@/contexts/DashboardContext";
import { toLocalDateString } from "@/lib/dateRange";

const WEEKDAY_LABELS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const NAME_TO_UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amapa": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Ceara": "CE", "Distrito Federal": "DF",
  "Espírito Santo": "ES", "Espirito Santo": "ES", "Goiás": "GO", "Goias": "GO",
  "Maranhão": "MA", "Maranhao": "MA", "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA", "Para": "PA",
  "Paraíba": "PB", "Paraiba": "PB", "Paraná": "PR", "Parana": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Piaui": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Rondonia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sao Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO",
};

function toUF(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const direct = NAME_TO_UF[s] || NAME_TO_UF[s.replace(/\b\w/g, (c) => c.toUpperCase())];
  if (direct) return direct;
  const lower = s.toLowerCase();
  for (const [name, uf] of Object.entries(NAME_TO_UF)) {
    if (name.toLowerCase() === lower) return uf;
  }
  return null;
}

export interface CanonicalLead {
  meta_lead_id: string;
  ad_account_id: string;
  ad_id: string | null;
  created_time: string;
  lead_state: string | null;
}

export function useLeadsCanonical() {
  const { startDate, endDate, adAccountId } = useDashboard();
  const start = toLocalDateString(startDate);
  const end = toLocalDateString(endDate);

  const q = useQuery({
    queryKey: ["meta_leads_canonical", adAccountId ?? "all", start, end],
    queryFn: async () => {
      const startISO = new Date(`${start}T00:00:00`).toISOString();
      const endISO = new Date(`${end}T23:59:59.999`).toISOString();
      let query = supabase
        .from("meta_leads" as any)
        .select("meta_lead_id, ad_account_id, ad_id, created_time, lead_state")
        .gte("created_time", startISO)
        .lte("created_time", endISO);
      if (adAccountId) query = query.eq("ad_account_id", adAccountId);
      const PAGE = 1000;
      let all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await query.range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as any[];
        all = all.concat(rows);
        if (rows.length < PAGE) break;
      }
      return all as CanonicalLead[];
    },
  });

  const rows = q.data || [];

  return useMemo(() => {
    const total = rows.length;

    const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, leads: 0 }));
    const byWeekday = Array.from({ length: 7 }, (_, i) => ({
      weekday: i,
      label: WEEKDAY_LABELS[i],
      short: WEEKDAY_SHORT[i],
      leads: 0,
    }));
    const byUF: Record<string, number> = {};
    let withState = 0;
    let manha = 0, tarde = 0, noite = 0;

    for (const r of rows) {
      const d = parseISO(r.created_time);
      const h = d.getHours();
      byHour[h].leads += 1;
      if (h >= 6 && h < 12) manha++;
      else if (h >= 12 && h < 18) tarde++;
      else noite++;
      const js = d.getDay();
      const idx = js === 0 ? 6 : js - 1;
      byWeekday[idx].leads += 1;
      const uf = toUF(r.lead_state);
      if (uf) {
        byUF[uf] = (byUF[uf] || 0) + 1;
        withState++;
      }
    }
    const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
    return {
      total,
      hasData: total > 0,
      byHour,
      byWeekday,
      byUF,
      coverage: { withState, total, pct: total > 0 ? (withState / total) * 100 : 0 },
      byPeriod: {
        manha: { leads: manha, pct: pct(manha) },
        tarde: { leads: tarde, pct: pct(tarde) },
        noite: { leads: noite, pct: pct(noite) },
        total,
      },
      isLoading: q.isLoading,
    };
  }, [rows, q.isLoading]);
}
