import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfDay } from "date-fns";

const NAME_TO_UF: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM",
  "bahia": "BA", "ceara": "CE", "distrito federal": "DF", "espirito santo": "ES",
  "goias": "GO", "maranhao": "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", "para": "PA", "paraiba": "PB", "parana": "PR",
  "pernambuco": "PE", "piaui": "PI", "rio de janeiro": "RJ",
  "rio grande do norte": "RN", "rio grande do sul": "RS", "rondonia": "RO",
  "roraima": "RR", "santa catarina": "SC", "sao paulo": "SP",
  "sergipe": "SE", "tocantins": "TO",
};
const VALID_UF = new Set(Object.values(NAME_TO_UF));

function normalizeUF(raw: string | null | undefined): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  const up = s.toUpperCase();
  if (s.length === 2 && VALID_UF.has(up)) return up;
  const key = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (NAME_TO_UF[key]) return NAME_TO_UF[key];
  // Try prefix match (e.g., "São Paulo - SP")
  for (const [name, uf] of Object.entries(NAME_TO_UF)) {
    if (key.startsWith(name)) return uf;
  }
  // Trailing UF (e.g., "Cidade/SP")
  const m = up.match(/\b([A-Z]{2})\b\s*$/);
  if (m && VALID_UF.has(m[1])) return m[1];
  return "—";
}


export type StageBucket = "lead" | "mql" | "sql" | "opportunity" | "client" | "lost";

export interface RDDeal {
  id: string;
  rd_funnel_id: string;
  rd_deal_id: string;
  rd_stage_id: string | null;
  rd_stage_name: string | null;
  rd_stage_order: number | null;
  deal_owner_name: string | null;
  rd_product_name: string | null;
  stage_bucket: StageBucket;
  win: boolean;
  lost_reason: string | null;
  amount_total: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  lead_state: string | null;
  lead_city: string | null;
  lead_created_at: string | null;
  stage_updated_at: string | null;
  closed_at: string | null;
}

export interface FunnelStage {
  rd_stage_id: string;
  name: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
}

interface Params {
  funnelId?: string;
  startDate?: Date;
  endDate?: Date;
  source?: string;
  state?: string;
  campaign?: string;
  owner?: string;
  product?: string;
  enabled?: boolean;
}

const DEAL_FIELDS =
  "id, rd_funnel_id, rd_deal_id, rd_stage_id, rd_stage_name, rd_stage_order, deal_owner_name, rd_product_name, stage_bucket, win, lost_reason, amount_total, utm_source, utm_medium, utm_campaign, lead_state, lead_city, lead_created_at, stage_updated_at, closed_at";

export function useRDDeals(params: Params) {
  const { funnelId, startDate, endDate, source, state, campaign, owner, product, enabled = true } = params;
  return useQuery({
    queryKey: [
      "rd_deals",
      funnelId,
      startDate?.toISOString(),
      endDate?.toISOString(),
      source ?? "all",
      state ?? "all",
      campaign ?? "all",
      owner ?? "all",
      product ?? "all",
    ],
    enabled: enabled && !!funnelId,
    queryFn: async () => {
      let query = supabase
        .from("rd_deals")
        .select(DEAL_FIELDS)
        .eq("rd_funnel_id", funnelId!)
        .order("lead_created_at", { ascending: false });

      if (startDate) query = query.gte("lead_created_at", startDate.toISOString());
      if (endDate) query = query.lte("lead_created_at", endOfDay(endDate).toISOString());
      if (source && source !== "all") query = query.eq("utm_source", source);
      if (state && state !== "all") query = query.eq("lead_state", state);
      if (campaign && campaign !== "all") query = query.eq("utm_campaign", campaign);
      if (owner && owner !== "all") query = query.eq("deal_owner_name", owner);
      if (product && product !== "all") query = query.eq("rd_product_name", product);

      const PAGE = 1000;
      const MAX = 10;
      let all: RDDeal[] = [];
      for (let p = 0; p < MAX; p++) {
        const from = p * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await query.range(from, to);
        if (error) throw error;
        const batch = (data || []) as unknown as RDDeal[];
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }
      return all;
    },
  });
}

export function useFunnelStages(funnelId?: string) {
  return useQuery({
    queryKey: ["rd_funnel_stages", funnelId],
    enabled: !!funnelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rd_funnel_stages")
        .select("rd_stage_id, name, order, is_won, is_lost")
        .eq("rd_funnel_id", funnelId!)
        .order("order", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as FunnelStage[];
    },
  });
}

// ============================================================================
// Analytics dinâmicas baseadas nos estágios REAIS do funil RD
// ============================================================================

export interface FunnelAnalytics {
  totalLeads: number;
  qualifiedLeads: number;
  conversions: number;
  lostDeals: number;
  conversionRate: number;
  qualificationRate: number;
  avgDaysToConvert: number;
  avgTicket: number;
  revenue: number;
  stages: {
    rd_stage_id: string;
    name: string;
    order: number;
    is_won: boolean;
    is_lost: boolean;
    count: number;          // leads atualmente nesta etapa
    cumulative: number;     // leads que chegaram nesta etapa ou em uma posterior
    pct: number;            // % sobre o total
    avgDaysInStage: number; // tempo médio parado
    valueInNegotiation: number;
  }[];
  stageConversion: {
    from: string;
    to: string;
    label: string;
    rate: number;          // %
    lost: number;          // leads perdidos na passagem
    lossPct: number;
    isBottleneck: boolean;
  }[];
  evolution: { date: string; leads: number; opportunities: number; conversions: number }[];
  agingBuckets: { gt3: number; gt7: number; gt15: number };
  bottleneck: { from: string; to: string; lossPct: number } | null;
  sourceBreakdown: {
    source: string;
    leads: number;
    sales: number;
    conversionRate: number;
    revenue: number;
  }[];
  lostReasons: { reason: string; count: number; pct: number }[];
  stateBreakdown: {
    state: string;
    leads: number;
    conversions: number;
    conversionRate: number;
  }[];
  weekdayBreakdown: {
    weekday: number;
    label: string;
    leads: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
  }[];
  hourBreakdown: {
    period: "Manhã" | "Tarde" | "Noite" | "Madrugada";
    leads: number;
    conversions: number;
    conversionRate: number;
    hours: { hour: number; leads: number; conversions: number; revenue: number }[];
  }[];
  ownerBreakdown: { owner: string; deals: number; wins: number }[];
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function periodOfHour(h: number): "Manhã" | "Tarde" | "Noite" | "Madrugada" {
  if (h >= 5 && h < 12) return "Manhã";
  if (h >= 12 && h < 18) return "Tarde";
  if (h >= 18 && h < 24) return "Noite";
  return "Madrugada";
}

export function computeFunnelAnalytics(deals: RDDeal[], stages: FunnelStage[]): FunnelAnalytics {
  const totalLeads = deals.length;

  // Ordena estágios pelo "order" real do RD
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  // Sequência (sem perdido) para taxas de avanço
  const sequence = sortedStages.filter((s) => !s.is_lost);

  // Mapa: stage_id -> índice na sequência
  const indexInSeq = new Map<string, number>();
  sequence.forEach((s, i) => indexInSeq.set(s.rd_stage_id, i));

  // Contagem por stage_id atual
  const currentCount = new Map<string, number>();
  const valueByStage = new Map<string, number>();
  const daysSumByStage = new Map<string, number>();
  const daysCountByStage = new Map<string, number>();

  let qualifiedLeads = 0;
  let conversions = 0;
  let lostDeals = 0;
  let revenue = 0;
  const wonAmounts: number[] = [];

  const now = Date.now();
  for (const d of deals) {
    const sid = d.rd_stage_id || "";
    currentCount.set(sid, (currentCount.get(sid) || 0) + 1);
    valueByStage.set(sid, (valueByStage.get(sid) || 0) + (d.amount_total || 0));

    if (d.stage_updated_at) {
      const days = (now - new Date(d.stage_updated_at).getTime()) / 86400000;
      if (days >= 0) {
        daysSumByStage.set(sid, (daysSumByStage.get(sid) || 0) + days);
        daysCountByStage.set(sid, (daysCountByStage.get(sid) || 0) + 1);
      }
    }

    if (d.win) {
      conversions += 1;
      revenue += d.amount_total || 0;
      wonAmounts.push(d.amount_total || 0);
    } else if (d.stage_bucket === "lost") {
      lostDeals += 1;
    }
  }

  // Cumulativo: chegou neste estágio = está aqui OU em algum estágio posterior na sequência
  // Considera perdidos (lost) como atribuídos à última etapa em que estavam? Sem rastro, contamos como ao menos lead.
  const cumulativeBySeqIdx = sequence.map(() => 0);
  for (const d of deals) {
    const idx = d.rd_stage_id ? indexInSeq.get(d.rd_stage_id) ?? -1 : -1;
    if (idx >= 0) {
      for (let i = 0; i <= idx; i++) cumulativeBySeqIdx[i] += 1;
    } else if (d.stage_bucket !== "lost") {
      cumulativeBySeqIdx[0] += 1;
    } else {
      // lost: ao menos passou pela primeira etapa
      if (cumulativeBySeqIdx.length > 0) cumulativeBySeqIdx[0] += 1;
    }
  }

  // Define "qualificados" como quem passou da metade do funil
  const midIdx = Math.floor(sequence.length / 2);
  qualifiedLeads = sequence.length > 0 ? cumulativeBySeqIdx[Math.max(1, midIdx)] || 0 : 0;

  const stagesOut = sortedStages.map((s) => {
    const idx = indexInSeq.get(s.rd_stage_id);
    const cumulative = idx != null ? cumulativeBySeqIdx[idx] : 0;
    const count = currentCount.get(s.rd_stage_id) || 0;
    const value = valueByStage.get(s.rd_stage_id) || 0;
    const daysSum = daysSumByStage.get(s.rd_stage_id) || 0;
    const daysN = daysCountByStage.get(s.rd_stage_id) || 0;
    return {
      rd_stage_id: s.rd_stage_id,
      name: s.name,
      order: s.order,
      is_won: s.is_won,
      is_lost: s.is_lost,
      count,
      cumulative,
      pct: totalLeads > 0 ? (count / totalLeads) * 100 : 0,
      avgDaysInStage: daysN > 0 ? daysSum / daysN : 0,
      valueInNegotiation: value,
    };
  });

  // Taxa de avanço entre etapas (apenas estágios não perdidos)
  const stageConversion: FunnelAnalytics["stageConversion"] = [];
  for (let i = 0; i < sequence.length - 1; i++) {
    const from = cumulativeBySeqIdx[i];
    const to = cumulativeBySeqIdx[i + 1];
    const rate = from > 0 ? (to / from) * 100 : 0;
    const lost = Math.max(0, from - to);
    const lossPct = from > 0 ? (lost / from) * 100 : 0;
    stageConversion.push({
      from: sequence[i].name,
      to: sequence[i + 1].name,
      label: `${sequence[i].name} → ${sequence[i + 1].name}`,
      rate,
      lost,
      lossPct,
      isBottleneck: false,
    });
  }
  // marcar maior queda
  if (stageConversion.length > 0) {
    const worst = stageConversion.reduce((a, b) => (b.lossPct > a.lossPct ? b : a));
    worst.isBottleneck = true;
  }

  const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;
  const qualificationRate = totalLeads > 0 ? (qualifiedLeads / totalLeads) * 100 : 0;
  const avgTicket = wonAmounts.length > 0 ? wonAmounts.reduce((a, b) => a + b, 0) / wonAmounts.length : 0;

  // Tempo médio até conversão
  const wonWithDates = deals.filter((d) => d.win && d.lead_created_at && d.closed_at);
  const avgDaysToConvert =
    wonWithDates.length > 0
      ? wonWithDates.reduce((s, d) => {
          const a = new Date(d.lead_created_at!).getTime();
          const b = new Date(d.closed_at!).getTime();
          return s + Math.max(0, (b - a) / 86400000);
        }, 0) / wonWithDates.length
      : 0;

  // Evolução diária — leads, oportunidades (a partir do meio da sequência), vendas
  const oppIdxThreshold = Math.max(1, Math.floor(sequence.length * 0.6));
  const evoMap = new Map<string, { leads: number; opportunities: number; conversions: number }>();
  for (const d of deals) {
    if (d.lead_created_at) {
      const day = d.lead_created_at.slice(0, 10);
      const cur = evoMap.get(day) || { leads: 0, opportunities: 0, conversions: 0 };
      cur.leads += 1;
      const idx = d.rd_stage_id ? indexInSeq.get(d.rd_stage_id) ?? -1 : -1;
      if (idx >= oppIdxThreshold) cur.opportunities += 1;
      evoMap.set(day, cur);
    }
    if (d.win && d.closed_at) {
      const day = d.closed_at.slice(0, 10);
      const cur = evoMap.get(day) || { leads: 0, opportunities: 0, conversions: 0 };
      cur.conversions += 1;
      evoMap.set(day, cur);
    }
  }
  const evolution = Array.from(evoMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Aging — leads não fechados parados há X dias (baseado em stage_updated_at)
  const agingBuckets = { gt3: 0, gt7: 0, gt15: 0 };
  for (const d of deals) {
    if (d.win || d.stage_bucket === "lost") continue;
    const ref = d.stage_updated_at || d.lead_created_at;
    if (!ref) continue;
    const days = (now - new Date(ref).getTime()) / 86400000;
    if (days > 15) agingBuckets.gt15 += 1;
    else if (days > 7) agingBuckets.gt7 += 1;
    else if (days > 3) agingBuckets.gt3 += 1;
  }

  const bottleneck = stageConversion.find((s) => s.isBottleneck)
    ? { from: stageConversion.find((s) => s.isBottleneck)!.from, to: stageConversion.find((s) => s.isBottleneck)!.to, lossPct: stageConversion.find((s) => s.isBottleneck)!.lossPct }
    : null;

  // Source breakdown
  const srcMap = new Map<string, { leads: number; sales: number; revenue: number }>();
  for (const d of deals) {
    const k = d.utm_source || "Não informado";
    const cur = srcMap.get(k) || { leads: 0, sales: 0, revenue: 0 };
    cur.leads += 1;
    if (d.win) {
      cur.sales += 1;
      cur.revenue += d.amount_total || 0;
    }
    srcMap.set(k, cur);
  }
  const sourceBreakdown = Array.from(srcMap.entries())
    .map(([source, v]) => ({
      source,
      leads: v.leads,
      sales: v.sales,
      conversionRate: v.leads > 0 ? (v.sales / v.leads) * 100 : 0,
      revenue: v.revenue,
    }))
    .sort((a, b) => b.sales - a.sales);

  // Motivos de perda
  const lostMap = new Map<string, number>();
  for (const d of deals) {
    if (d.stage_bucket === "lost") {
      const r = d.lost_reason || "Não informado";
      lostMap.set(r, (lostMap.get(r) || 0) + 1);
    }
  }
  const totalLost = Array.from(lostMap.values()).reduce((a, b) => a + b, 0);
  const lostReasons = Array.from(lostMap.entries())
    .map(([reason, count]) => ({ reason, count, pct: totalLost > 0 ? (count / totalLost) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  // Estado — normaliza nome completo → UF (mesma lógica da dashboard principal)
  const stateMap = new Map<string, { leads: number; conversions: number }>();
  for (const d of deals) {
    const k = normalizeUF(d.lead_state);
    const cur = stateMap.get(k) || { leads: 0, conversions: 0 };
    cur.leads += 1;
    if (d.win) cur.conversions += 1;
    stateMap.set(k, cur);
  }
  const stateBreakdown = Array.from(stateMap.entries())
    .map(([state, v]) => ({
      state,
      leads: v.leads,
      conversions: v.conversions,
      conversionRate: v.leads > 0 ? (v.conversions / v.leads) * 100 : 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  // Weekday
  const wdMap = new Map<number, { leads: number; conversions: number; revenue: number }>();
  for (let i = 0; i < 7; i++) wdMap.set(i, { leads: 0, conversions: 0, revenue: 0 });
  for (const d of deals) {
    if (d.lead_created_at) {
      const wd = new Date(d.lead_created_at).getDay();
      const cur = wdMap.get(wd)!;
      cur.leads += 1;
    }
    if (d.win && d.closed_at) {
      const wd = new Date(d.closed_at).getDay();
      const cur = wdMap.get(wd)!;
      cur.conversions += 1;
      cur.revenue += d.amount_total || 0;
    }
  }
  const weekdayBreakdown = Array.from(wdMap.entries()).map(([wd, v]) => ({
    weekday: wd,
    label: WEEKDAYS[wd],
    leads: v.leads,
    conversions: v.conversions,
    revenue: v.revenue,
    conversionRate: v.leads > 0 ? (v.conversions / v.leads) * 100 : 0,
  }));

  // Hora do dia
  const periodMap = new Map<string, { leads: number; conversions: number }>([
    ["Manhã", { leads: 0, conversions: 0 }],
    ["Tarde", { leads: 0, conversions: 0 }],
    ["Noite", { leads: 0, conversions: 0 }],
    ["Madrugada", { leads: 0, conversions: 0 }],
  ]);
  const hourMap = new Map<number, { leads: number; conversions: number; revenue: number }>();
  for (let h = 0; h < 24; h++) hourMap.set(h, { leads: 0, conversions: 0, revenue: 0 });
  for (const d of deals) {
    if (d.lead_created_at) {
      const h = new Date(d.lead_created_at).getHours();
      const p = periodOfHour(h);
      periodMap.get(p)!.leads += 1;
      hourMap.get(h)!.leads += 1;
    }
    if (d.win && d.closed_at) {
      const h = new Date(d.closed_at).getHours();
      const p = periodOfHour(h);
      periodMap.get(p)!.conversions += 1;
      const hv = hourMap.get(h)!;
      hv.conversions += 1;
      hv.revenue += d.amount_total || 0;
    }
  }
  const hourBreakdown = (["Manhã", "Tarde", "Noite", "Madrugada"] as const).map((p) => {
    const v = periodMap.get(p)!;
    const hours = Array.from(hourMap.entries())
      .filter(([h]) => periodOfHour(h) === p)
      .map(([hour, hv]) => ({ hour, leads: hv.leads, conversions: hv.conversions, revenue: hv.revenue }))
      .sort((a, b) => a.hour - b.hour);
    return {
      period: p,
      leads: v.leads,
      conversions: v.conversions,
      conversionRate: v.leads > 0 ? (v.conversions / v.leads) * 100 : 0,
      hours,
    };
  });


  // Responsável
  const ownerMap = new Map<string, { deals: number; wins: number }>();
  for (const d of deals) {
    const k = d.deal_owner_name || "Não atribuído";
    const cur = ownerMap.get(k) || { deals: 0, wins: 0 };
    cur.deals += 1;
    if (d.win) cur.wins += 1;
    ownerMap.set(k, cur);
  }
  const ownerBreakdown = Array.from(ownerMap.entries())
    .map(([owner, v]) => ({ owner, ...v }))
    .sort((a, b) => b.deals - a.deals);

  return {
    totalLeads,
    qualifiedLeads,
    conversions,
    lostDeals,
    conversionRate,
    qualificationRate,
    avgDaysToConvert,
    avgTicket,
    revenue,
    stages: stagesOut,
    stageConversion,
    evolution,
    agingBuckets,
    bottleneck,
    sourceBreakdown,
    lostReasons,
    stateBreakdown,
    weekdayBreakdown,
    hourBreakdown,
    ownerBreakdown,
  };
}
