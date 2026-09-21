import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format } from "date-fns";
import { isWonRDStageName } from "@/lib/rdDealStatus";
import { canonicalWonDeals, canonicalWonDate, isCanonicalWonDealInPeriod, saoPauloDayBounds } from "@/lib/canonicalMetrics";
import { consolidatedCRMStage } from "@/lib/crmPipelineStages";
import { withRequestTimeout } from "@/lib/resilience";

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

export function normalizeUF(raw: string | null | undefined): string {
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
  rd_connection_id?: string | null;
  ad_account_id: string | null;
  rd_funnel_id: string | null;
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
  utm_term: string | null;
  utm_content: string | null;
  utm_id: string | null;
  lead_state: string | null;
  lead_city: string | null;
  contact_name?: string | null;
  custom_fields?: Record<string, unknown> | null;
  lead_created_at: string | null;
  stage_updated_at: string | null;
  closed_at: string | null;
  updated_at?: string | null;
}

export interface FunnelStage {
  rd_funnel_id: string;
  rd_stage_id: string;
  name: string;
  order: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface RDDealStageHistory {
  id: string;
  rd_deal_id: string;
  rd_funnel_id: string;
  from_stage_id: string | null;
  from_stage_name: string | null;
  from_stage_bucket: string | null;
  to_stage_id: string | null;
  to_stage_name: string | null;
  to_stage_bucket: string | null;
  changed_at: string;
}

/**
 * Returns the first trustworthy timestamp available for a RD negotiation.
 * Older imports may not have `lead_created_at`; using the stage update (and
 * finally the closing timestamp) keeps a real lead visible in daily reports
 * without fabricating a date.
 */
export function rdDealEventDate(deal: Pick<RDDeal, "lead_created_at" | "stage_updated_at" | "closed_at">): string | null {
  for (const value of [deal.lead_created_at, deal.stage_updated_at, deal.closed_at]) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return value;
  }
  return null;
}

/** Canonical timestamp for a won RD deal. Older imports often omit closed_at;
 * the last real stage movement is the only trustworthy period fallback. */
export function rdDealWonDate(deal: Pick<RDDeal, "closed_at" | "stage_updated_at">): string | null {
  return canonicalWonDate(deal);
}

type CanonicalFunnelStage = Omit<FunnelStage, "rd_stage_id"> & { rd_stage_id: string };

/**
 * Multiple connected RD funnels can expose the same operational stage with
 * different IDs. A consolidated view must have one pipeline (not one copy of
 * "Lead novo", "Oportunidade" etc. per account), while the original IDs keep
 * mapping each deal to that canonical stage.
 */
export function consolidateFunnelStages(stages: FunnelStage[]) {
  const funnelIds = new Set(stages.map((stage) => stage.rd_funnel_id));
  if (funnelIds.size === 1) {
    const sourceToCanonicalId = new Map(stages.map((stage) => [stage.rd_stage_id, stage.rd_stage_id]));
    return {
      stages: [...stages].sort((a, b) => a.order - b.order || a.rd_stage_id.localeCompare(b.rd_stage_id)),
      sourceToCanonicalId,
    };
  }
  const sourceToCanonicalId = new Map<string, string>();
  const canonicalById = new Map<string, CanonicalFunnelStage>();

  for (const stage of stages) {
    const canonical = consolidatedCRMStage({
      id: stage.rd_stage_id,
      name: stage.name,
      order: stage.order,
      won: stage.is_won,
      lost: stage.is_lost,
    });
    sourceToCanonicalId.set(stage.rd_stage_id, canonical.id);
    const current = canonicalById.get(canonical.id);
    if (!current || canonical.order < current.order) {
      canonicalById.set(canonical.id, {
        rd_stage_id: canonical.id,
        name: canonical.name,
        order: canonical.order,
        is_won: canonical.won,
        is_lost: canonical.lost,
      });
    }
  }

  return {
    stages: Array.from(canonicalById.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")),
    sourceToCanonicalId,
  };
}

export function useRDDealStageHistory({ funnelIds, startDate, endDate, enabled = true }: { funnelIds: string[]; startDate: Date; endDate: Date; enabled?: boolean }) {
  const scopeIds = Array.from(new Set(funnelIds)).sort();
  return useQuery({
    queryKey: ["rd_deal_stage_history", scopeIds.join(","), startDate.toISOString(), endDate.toISOString()],
    enabled: enabled && scopeIds.length > 0,
    queryFn: async () => {
      const bounds = saoPauloDayBounds(startDate, endDate);
      const { data, error } = await withRequestTimeout(supabase
        .from("rd_deal_stage_history")
        .select("id, rd_deal_id, rd_funnel_id, from_stage_id, from_stage_name, from_stage_bucket, to_stage_id, to_stage_name, to_stage_bucket, changed_at")
        .in("rd_funnel_id", scopeIds)
        .gte("changed_at", bounds.start.toISOString())
        .lte("changed_at", bounds.end.toISOString())
        .order("changed_at", { ascending: true }), 15_000);
      if (error) throw error;
      return (data || []) as RDDealStageHistory[];
    },
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

interface Params {
  funnelId?: string;
  funnelIds?: string[];
  adAccountId?: string;
  adAccountIds?: string[];
  startDate?: Date;
  endDate?: Date;
  source?: string;
  state?: string;
  campaign?: string;
  campaigns?: string[];
  owner?: string;
  product?: string;
  /**
   * O RD mantém o pipeline atual independentemente da data em que o lead foi
   * criado. Em análises de funil, ocultar um lead antigo que ainda está em
   * negociação produz um funil vazio e uma conversão incorreta.
   */
  includeHistory?: boolean;
  enabled?: boolean;
}

export function shouldApplyRDDateRange(includeHistory = false) {
  return !includeHistory;
}

const DEAL_FIELDS =
  "id, rd_connection_id, ad_account_id, rd_funnel_id, rd_deal_id, rd_stage_id, rd_stage_name, rd_stage_order, deal_owner_name, rd_product_name, stage_bucket, win, lost_reason, amount_total, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, lead_state, lead_city, contact_name, custom_fields, lead_created_at, stage_updated_at, closed_at, updated_at";

/** Keeps the newest snapshot of a single RD deal when an integration retry
 * left more than one local row. The RD deal ID is global and is the canonical
 * identity across a combined-account analysis. */
export function dedupeRDDeals(rows: RDDeal[]) {
  const unique = new Map<string, RDDeal>();
  for (const row of rows) {
    const key = `${row.rd_connection_id || row.ad_account_id || "legacy"}:${row.rd_deal_id || row.id}`;
    const current = unique.get(key);
    const rowTime = new Date(row.updated_at || row.stage_updated_at || row.closed_at || row.lead_created_at || 0).getTime();
    const currentTime = current ? new Date(current.updated_at || current.stage_updated_at || current.closed_at || current.lead_created_at || 0).getTime() : -Infinity;
    if (!current || rowTime >= currentTime) unique.set(key, row);
  }
  return Array.from(unique.values());
}

export function useRDDeals(params: Params) {
  const { funnelId, funnelIds, adAccountId, adAccountIds, startDate, endDate, source, state, campaign, campaigns, owner, product, includeHistory = false, enabled = true } = params;
  const scopeIds = funnelIds?.length ? Array.from(new Set(funnelIds)).sort() : funnelId ? [funnelId] : [];
  return useQuery({
    queryKey: [
      "rd_deals",
      scopeIds.join(","),
      adAccountId ?? "all",
      adAccountIds?.slice().sort().join(",") ?? "",
      startDate?.toISOString(),
      endDate?.toISOString(),
      source ?? "all",
      state ?? "all",
      campaigns?.slice().sort().join(",") || campaign || "all",
      owner ?? "all",
      product ?? "all",
      includeHistory ? "history" : "period",
    ],
    enabled: enabled && scopeIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("rd_deals")
        .select(DEAL_FIELDS)
        .order("lead_created_at", { ascending: false });
      query = scopeIds.length === 1 ? query.eq("rd_funnel_id", scopeIds[0]) : query.in("rd_funnel_id", scopeIds);
      if (adAccountId) query = query.eq("ad_account_id", adAccountId);
      else if (adAccountIds?.length) query = query.in("ad_account_id", adAccountIds);

      if (shouldApplyRDDateRange(includeHistory) && (startDate || endDate)) {
        // Older RD imports may not have lead_created_at. Keep those leads in
        // the selected period using the next trustworthy event timestamp,
        // matching useRDDealsForPeriod and preventing silent under-counting
        // in Perfil do público e entrega.
        const bounds = saoPauloDayBounds(startDate ?? endDate!, endDate ?? startDate!);
        const rangeStart = bounds.start.toISOString();
        const rangeEnd = bounds.end.toISOString();
        query = query.or(`and(lead_created_at.gte.${rangeStart},lead_created_at.lte.${rangeEnd}),and(stage_updated_at.gte.${rangeStart},stage_updated_at.lte.${rangeEnd}),and(lead_created_at.is.null,stage_updated_at.is.null,closed_at.gte.${rangeStart},closed_at.lte.${rangeEnd})`);
      }
      if (source && source !== "all") query = query.eq("utm_source", source);
      if (state && state !== "all") query = query.eq("lead_state", state);
      if (campaigns?.length) query = query.in("utm_campaign", campaigns); else if (campaign && campaign !== "all") query = query.eq("utm_campaign", campaign);
      if (owner && owner !== "all") query = query.eq("deal_owner_name", owner);
      if (product && product !== "all") query = query.eq("rd_product_name", product);

      const PAGE = 1000;
      let all: RDDeal[] = [];
      for (let p = 0; ; p++) {
        const from = p * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await withRequestTimeout(query.range(from, to), 15_000);
        if (error) throw error;
        const batch = (data || []) as unknown as RDDeal[];
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }
      return dedupeRDDeals(all);
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/** Negócios ganhos pela data real de fechamento.
 *
 * Leads e distribuição de etapas usam a data de entrada do lead; vendas,
 * receita e tempo de conversão precisam usar `closed_at`. Misturar as duas
 * datas foi a principal causa de divergência com os relatórios do RD.
 */
export function useRDClosedDeals(params: Params) {
  const { funnelId, funnelIds, adAccountId, adAccountIds, startDate, endDate, source, state, campaign, campaigns, owner, product, includeHistory = false, enabled = true } = params;
  const scopeIds = funnelIds?.length ? Array.from(new Set(funnelIds)).sort() : funnelId ? [funnelId] : [];
  return useQuery({
    queryKey: [
      "rd_closed_deals",
      scopeIds.join(","),
      adAccountId ?? "all",
      adAccountIds?.slice().sort().join(",") ?? "",
      startDate?.toISOString(),
      endDate?.toISOString(),
      source ?? "all",
      state ?? "all",
      campaigns?.slice().sort().join(",") || campaign || "all",
      owner ?? "all",
      product ?? "all",
      includeHistory ? "history" : "period",
    ],
    enabled: enabled && scopeIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("rd_deals")
        .select(DEAL_FIELDS)
        .order("closed_at", { ascending: false, nullsFirst: false });
      query = scopeIds.length === 1 ? query.eq("rd_funnel_id", scopeIds[0]) : query.in("rd_funnel_id", scopeIds);
      if (adAccountId) query = query.eq("ad_account_id", adAccountId);
      else if (adAccountIds?.length) query = query.in("ad_account_id", adAccountIds);

      if (source && source !== "all") query = query.eq("utm_source", source);
      if (state && state !== "all") query = query.eq("lead_state", state);
      if (campaigns?.length) query = query.in("utm_campaign", campaigns); else if (campaign && campaign !== "all") query = query.eq("utm_campaign", campaign);
      if (owner && owner !== "all") query = query.eq("deal_owner_name", owner);
      if (product && product !== "all") query = query.eq("rd_product_name", product);

      const PAGE = 1000;
      let all: RDDeal[] = [];
      for (let p = 0; ; p++) {
        const { data, error } = await withRequestTimeout(query.range(p * PAGE, p * PAGE + PAGE - 1), 15_000);
        if (error) throw error;
        const batch = (data || []) as unknown as RDDeal[];
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }
      // Alguns pipelines do RD mantêm a etapa final como “Vendas realizadas”
      // antes de preencher o booleano técnico `win`. Não descartamos essas
      // vendas reais por causa da ordem de sincronização.
      const won = dedupeRDDeals(all).filter((deal) => deal.win || isWonRDStageName(deal.rd_stage_name));
      if (includeHistory || (!startDate && !endDate)) return won;
      return won.filter((deal) => isCanonicalWonDealInPeriod(deal, startDate ?? endDate!, endDate ?? startDate!));
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFunnelStages(funnelId?: string) {
  return useFunnelStagesForIds(funnelId ? [funnelId] : []);
}

export function useFunnelStagesForIds(funnelIds: string[]) {
  const scopeIds = Array.from(new Set(funnelIds)).sort();
  return useQuery({
    queryKey: ["rd_funnel_stages", scopeIds.join(",")],
    enabled: scopeIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("rd_funnel_stages")
        .select("rd_funnel_id, rd_stage_id, name, order, is_won, is_lost")
        .order("order", { ascending: true });
      query = scopeIds.length === 1 ? query.eq("rd_funnel_id", scopeIds[0]) : query.in("rd_funnel_id", scopeIds);
      const { data, error } = await withRequestTimeout(query, 15_000);
      if (error) throw error;
      return (data || []) as unknown as FunnelStage[];
    },
    refetchOnWindowFocus: false,
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
  standbyReasons: { reason: string; count: number; pct: number }[];
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

export function computeFunnelAnalytics(
  deals: RDDeal[],
  stages: FunnelStage[],
  closedDeals: RDDeal[] = deals.filter((deal) => deal.win),
  dateRange?: { startDate: Date; endDate: Date },
  stageHistory: RDDealStageHistory[] = [],
): FunnelAnalytics {
  const totalLeads = deals.length;

  const { stages: sortedStages } = consolidateFunnelStages(stages);
  const preserveNativeStages = new Set(stages.map((stage) => stage.rd_funnel_id)).size === 1;
  const canonicalDealStageId = (deal: RDDeal) => {
    // Stage IDs are scoped to an RD funnel. Resolving by ID alone mixed
    // identical stage IDs from different accounts in consolidated views.
    const nativeStage = stages.find((stage) => stage.rd_funnel_id === deal.rd_funnel_id && stage.rd_stage_id === deal.rd_stage_id);
    if (nativeStage && preserveNativeStages) return nativeStage.rd_stage_id;
    if (nativeStage) {
      return consolidatedCRMStage({
        id: nativeStage.rd_stage_id,
        name: nativeStage.name,
        order: nativeStage.order,
        won: nativeStage.is_won,
        lost: nativeStage.is_lost,
      }).id;
    }
    return consolidatedCRMStage({
      name: deal.rd_stage_name,
      order: deal.rd_stage_order ?? undefined,
      won: deal.win || isWonRDStageName(deal.rd_stage_name),
      lost: deal.stage_bucket === "lost",
    }).id;
  };

  // Sequência (sem perdido) para taxas de avanço
  const sequence = sortedStages.filter((s) => !s.is_lost);
  const wonStageIds = new Set(sortedStages.filter((stage) => stage.is_won).map((stage) => stage.rd_stage_id));
  const wonCandidates = [
    ...closedDeals,
    ...deals.filter((deal) => deal.win || wonStageIds.has(canonicalDealStageId(deal)) || isWonRDStageName(deal.rd_stage_name)),
  ].map((deal) => wonStageIds.has(canonicalDealStageId(deal)) ? { ...deal, win: true } : deal);
  const confirmedClosedDeals = canonicalWonDeals(
    dateRange
      ? dedupeRDDeals(wonCandidates).filter((deal) => isCanonicalWonDealInPeriod(deal, dateRange.startDate, dateRange.endDate))
      : dedupeRDDeals(wonCandidates),
  );

  // Mapa: stage_id -> índice na sequência
  const indexInSeq = new Map<string, number>();
  sequence.forEach((s, i) => indexInSeq.set(s.rd_stage_id, i));

  // Contagem por stage_id atual
  const currentCount = new Map<string, number>();
  const valueByStage = new Map<string, number>();
  const daysSumByStage = new Map<string, number>();
  const daysCountByStage = new Map<string, number>();

  let qualifiedLeads = 0;
  const conversions = confirmedClosedDeals.length;
  let lostDeals = 0;
  const revenue = confirmedClosedDeals.reduce((sum, deal) => sum + (deal.amount_total || 0), 0);
  const wonAmounts: number[] = confirmedClosedDeals.map((deal) => deal.amount_total || 0);

  const now = Date.now();
  for (const d of deals) {
    const sid = canonicalDealStageId(d);
    currentCount.set(sid, (currentCount.get(sid) || 0) + 1);
    valueByStage.set(sid, (valueByStage.get(sid) || 0) + (d.amount_total || 0));

    if (d.stage_updated_at) {
      const days = (now - new Date(d.stage_updated_at).getTime()) / 86400000;
      if (days >= 0) {
        daysSumByStage.set(sid, (daysSumByStage.get(sid) || 0) + days);
        daysCountByStage.set(sid, (daysCountByStage.get(sid) || 0) + 1);
      }
    }

    if (!d.win && d.stage_bucket === "lost") {
      lostDeals += 1;
    }
  }

  // Cada funil tem sua própria sequência. A união de estágios de funis
  // diferentes criava pares artificiais na taxa de avanço. Sem histórico de
  // movimentações, a progressão é inferida pelo estágio atual, mas somente
  // dentro da sequência real do funil daquele negócio.
  const cumulativeByCanonicalStage = new Map<string, number>();
  const pairCounts = new Map<string, { from: string; to: string; fromCount: number; toCount: number; order: number }>();
  const stagesByFunnel = new Map<string, FunnelStage[]>();
  for (const stage of stages) {
    const list = stagesByFunnel.get(stage.rd_funnel_id) || [];
    list.push(stage);
    stagesByFunnel.set(stage.rd_funnel_id, list);
  }
  const dealsByFunnel = new Map<string, RDDeal[]>();
  for (const deal of deals) {
    const list = dealsByFunnel.get(deal.rd_funnel_id) || [];
    list.push(deal);
    dealsByFunnel.set(deal.rd_funnel_id, list);
  }
  for (const [funnelId, funnelDeals] of dealsByFunnel) {
    const funnelSequence = (stagesByFunnel.get(funnelId) || [])
      .filter((stage) => !stage.is_lost)
      .sort((a, b) => a.order - b.order)
      .map((stage) => consolidatedCRMStage({
        id: stage.rd_stage_id,
        name: stage.name,
        order: stage.order,
        won: stage.is_won,
        lost: stage.is_lost,
      }).id)
      .filter((stageId, index, list) => list.indexOf(stageId) === index);
    if (!funnelSequence.length) continue;
    const stageIndex = new Map(funnelSequence.map((stageId, index) => [stageId, index]));
    for (const deal of funnelDeals) {
      const index = stageIndex.get(canonicalDealStageId(deal));
      if (index == null) {
        if (deal.stage_bucket === "lost") cumulativeByCanonicalStage.set(funnelSequence[0], (cumulativeByCanonicalStage.get(funnelSequence[0]) || 0) + 1);
        continue;
      }
      for (let position = 0; position <= index; position++) {
        const stageId = funnelSequence[position];
        cumulativeByCanonicalStage.set(stageId, (cumulativeByCanonicalStage.get(stageId) || 0) + 1);
      }
      for (let position = 0; position < funnelSequence.length - 1; position++) {
        if (index < position) continue;
        const fromStage = funnelSequence[position];
        const toStage = funnelSequence[position + 1];
        const fromDefinition = sortedStages.find((stage) => stage.rd_stage_id === fromStage);
        const toDefinition = sortedStages.find((stage) => stage.rd_stage_id === toStage);
        if (!fromDefinition || !toDefinition) continue;
        const key = `${fromStage}:${toStage}`;
        const current = pairCounts.get(key) || { from: fromDefinition.name, to: toDefinition.name, fromCount: 0, toCount: 0, order: position };
        // The same canonical pair can exist in more than one RD funnel. Keep
        // its earliest native position so the aggregated view preserves the
        // RD sequence instead of falling back to alphabetical label order.
        current.order = Math.min(current.order, position);
        current.fromCount += 1;
        if (index >= position + 1) current.toCount += 1;
        pairCounts.set(key, current);
      }
    }
  }

  // Define "qualificados" como quem passou da metade do funil
  const midIdx = Math.floor(sequence.length / 2);
  const semanticQualified = deals.filter((deal) => ["mql", "sql", "opportunity", "client"].includes(deal.stage_bucket)).length;
  qualifiedLeads = semanticQualified > 0
    ? semanticQualified
    : sequence.length > 0 ? cumulativeByCanonicalStage.get(sequence[Math.max(1, midIdx)]?.rd_stage_id) || 0 : 0;

  const stagesOut = sortedStages.map((s) => {
    const idx = indexInSeq.get(s.rd_stage_id);
    const cumulative = idx != null ? cumulativeByCanonicalStage.get(s.rd_stage_id) || 0 : 0;
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

  // Taxa de avanço: cada par é agregado apenas entre funis que contêm as
  // duas etapas adjacentes, sem criar uma sequência global entre contas.
  const stageConversion: FunnelAnalytics["stageConversion"] = [];
  const historyPairs = new Map<string, { from: string; to: string; fromCount: Set<string>; toCount: Set<string>; order: number }>();
  const nativeStageByKey = new Map(stages.map((stage) => [`${stage.rd_funnel_id}:${stage.rd_stage_id}`, stage]));
  for (const event of stageHistory) {
    if (!event.from_stage_id || !event.to_stage_id) continue;
    const fromId = preserveNativeStages ? event.from_stage_id : (consolidateFunnelStages(stages.filter((stage) => stage.rd_funnel_id === event.rd_funnel_id)).sourceToCanonicalId.get(event.from_stage_id) || event.from_stage_id);
    const toId = preserveNativeStages ? event.to_stage_id : (consolidateFunnelStages(stages.filter((stage) => stage.rd_funnel_id === event.rd_funnel_id)).sourceToCanonicalId.get(event.to_stage_id) || event.to_stage_id);
    const fromStage = nativeStageByKey.get(`${event.rd_funnel_id}:${event.from_stage_id}`);
    const toStage = nativeStageByKey.get(`${event.rd_funnel_id}:${event.to_stage_id}`);
    const order = toStage?.order ?? 9999;
    const key = `${fromId}:${toId}`;
    const pair = historyPairs.get(key) || { from: fromStage?.name || event.from_stage_name || fromId, to: toStage?.name || event.to_stage_name || toId, fromCount: new Set<string>(), toCount: new Set<string>(), order };
    pair.fromCount.add(event.rd_deal_id);
    pair.toCount.add(event.rd_deal_id);
    pair.order = Math.min(pair.order, order);
    historyPairs.set(key, pair);
  }
  const conversionPairs = stageHistory.length > 0
    ? Array.from(historyPairs.values()).map((pair) => ({ from: pair.from, to: pair.to, fromCount: pair.fromCount.size, toCount: pair.toCount.size, order: pair.order }))
    : Array.from(pairCounts.values());
  // Sem histórico real, não estimamos avanço pela etapa atual.
  for (const pair of (stageHistory.length > 0 ? conversionPairs : [] ).sort((a, b) => a.order - b.order || a.from.localeCompare(b.from, "pt-BR") || a.to.localeCompare(b.to, "pt-BR"))) {
    const rate = pair.fromCount > 0 ? (pair.toCount / pair.fromCount) * 100 : 0;
    const lost = Math.max(0, pair.fromCount - pair.toCount);
    const lossPct = pair.fromCount > 0 ? (lost / pair.fromCount) * 100 : 0;
    stageConversion.push({
      from: pair.from,
      to: pair.to,
      label: `${pair.from} → ${pair.to}`,
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
  const wonWithDates = confirmedClosedDeals.filter((d) => d.lead_created_at && d.closed_at);
  const avgDaysToConvert =
    wonWithDates.length > 0
      ? wonWithDates.reduce((s, d) => {
          const a = new Date(d.lead_created_at!).getTime();
          const b = new Date(d.closed_at!).getTime();
          return s + Math.max(0, (b - a) / 86400000);
        }, 0) / wonWithDates.length
      : 0;

  // Evolução diária — leads, oportunidades (a partir do meio da sequência), vendas.
  // Use the browser-local calendar day instead of slicing the UTC ISO string;
  // otherwise a selected day can appear under the previous/next date.
  const dayKey = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : format(parsed, "yyyy-MM-dd");
  };
  const oppIdxThreshold = Math.max(1, Math.floor(sequence.length * 0.6));
  const evoMap = new Map<string, { leads: number; opportunities: number; conversions: number }>();
  for (const d of deals) {
    const leadEventDate = rdDealEventDate(d);
    if (leadEventDate) {
      const day = dayKey(leadEventDate);
      const cur = evoMap.get(day) || { leads: 0, opportunities: 0, conversions: 0 };
      cur.leads += 1;
      const idx = indexInSeq.get(canonicalDealStageId(d)) ?? -1;
      // When stage history exists, opportunity dates come exclusively from
      // the real stage-entry event below. The current stage is only a safe
      // fallback for older snapshots without history.
      if (stageHistory.length === 0 && (idx >= oppIdxThreshold || ["mql", "sql", "opportunity", "client"].includes(d.stage_bucket))) cur.opportunities += 1;
      evoMap.set(day, cur);
    }
  }
  for (const d of confirmedClosedDeals) {
    const wonDate = rdDealWonDate(d);
    if (!wonDate) continue;
    const day = dayKey(wonDate);
    const cur = evoMap.get(day) || { leads: 0, opportunities: 0, conversions: 0 };
    cur.conversions += 1;
    evoMap.set(day, cur);
  }
  if (dateRange) {
    for (const day of eachDayOfInterval({ start: dateRange.startDate, end: dateRange.endDate })) {
      const key = format(day, "yyyy-MM-dd");
      if (!evoMap.has(key)) evoMap.set(key, { leads: 0, opportunities: 0, conversions: 0 });
    }
  }
  if (stageHistory.length > 0) {
    const seenOpportunityEvents = new Set<string>();
    for (const event of stageHistory) {
      const target = stages.find((stage) => stage.rd_funnel_id === event.rd_funnel_id && stage.rd_stage_id === event.to_stage_id);
      if (!target || target.is_lost) continue;
      const key = `${event.rd_deal_id}:${event.changed_at.slice(0, 10)}`;
      if (target.is_won) continue;
      if (target.order >= Math.max(1, Math.floor(sequence.length * 0.6)) && !seenOpportunityEvents.has(key)) {
        const day = dayKey(event.changed_at);
        const cur = evoMap.get(day) || { leads: 0, opportunities: 0, conversions: 0 };
        cur.opportunities += 1;
        seenOpportunityEvents.add(key);
        evoMap.set(day, cur);
      }
    }
  }
  const evolution = Array.from(evoMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  // Aging — leads não fechados parados há X dias (baseado em stage_updated_at)
  const agingBuckets = { gt3: 0, gt7: 0, gt15: 0 };
  for (const d of deals) {
    if (d.win || wonStageIds.has(canonicalDealStageId(d)) || isWonRDStageName(d.rd_stage_name) || d.stage_bucket === "lost") continue;
    const ref = d.stage_updated_at || d.lead_created_at;
    if (!ref) continue;
    const days = (now - new Date(ref).getTime()) / 86400000;
    if (days > 15) agingBuckets.gt15 += 1;
    else if (days > 7) agingBuckets.gt7 += 1;
    else if (days > 3) agingBuckets.gt3 += 1;
  }

  // Source breakdown
  const srcMap = new Map<string, { leads: number; sales: number; revenue: number }>();
  for (const d of deals) {
    const k = d.utm_source || "Não informado";
    const cur = srcMap.get(k) || { leads: 0, sales: 0, revenue: 0 };
    cur.leads += 1;
    srcMap.set(k, cur);
  }
  for (const d of confirmedClosedDeals) {
    const k = d.utm_source || "Não informado";
    const cur = srcMap.get(k) || { leads: 0, sales: 0, revenue: 0 };
    cur.sales += 1;
    cur.revenue += d.amount_total || 0;
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

  // "Stand By" é uma espera operacional, não uma perda. Quando o RD traz um
  // motivo nessa etapa, ele precisa ser visível separadamente para a equipe
  // agir sem contaminar os motivos de perda.
  const standbyMap = new Map<string, number>();
  for (const d of deals) {
    const stageName = String(d.rd_stage_name || "").toLocaleLowerCase("pt-BR");
    if (!/(stand\s*by|standby|aguardando)/.test(stageName)) continue;
    const reason = d.lost_reason || "Sem motivo informado";
    standbyMap.set(reason, (standbyMap.get(reason) || 0) + 1);
  }
  const totalStandby = Array.from(standbyMap.values()).reduce((sum, count) => sum + count, 0);
  const standbyReasons = Array.from(standbyMap.entries())
    .map(([reason, count]) => ({ reason, count, pct: totalStandby > 0 ? (count / totalStandby) * 100 : 0 }))
    .sort((a, b) => b.count - a.count);

  // Estado — normaliza nome completo → UF (mesma lógica da dashboard principal)
  const stateMap = new Map<string, { leads: number; conversions: number }>();
  for (const d of deals) {
    const k = normalizeUF(d.lead_state);
    const cur = stateMap.get(k) || { leads: 0, conversions: 0 };
    cur.leads += 1;
    stateMap.set(k, cur);
  }
  for (const d of confirmedClosedDeals) {
    const k = normalizeUF(d.lead_state);
    const cur = stateMap.get(k) || { leads: 0, conversions: 0 };
    cur.conversions += 1;
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
    const leadEventDate = rdDealEventDate(d);
    if (leadEventDate) {
      const wd = new Date(leadEventDate).getDay();
      const cur = wdMap.get(wd)!;
      cur.leads += 1;
    }
  }
  for (const d of confirmedClosedDeals) {
    const wonDate = rdDealWonDate(d);
    if (!wonDate) continue;
    const wd = new Date(wonDate).getDay();
    const cur = wdMap.get(wd)!;
    cur.conversions += 1;
    cur.revenue += d.amount_total || 0;
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
    const leadEventDate = rdDealEventDate(d);
    if (leadEventDate) {
      const h = new Date(leadEventDate).getHours();
      const p = periodOfHour(h);
      periodMap.get(p)!.leads += 1;
      hourMap.get(h)!.leads += 1;
    }
  }
  for (const d of confirmedClosedDeals) {
    const wonDate = rdDealWonDate(d);
    if (!wonDate) continue;
    const h = new Date(wonDate).getHours();
    const p = periodOfHour(h);
    periodMap.get(p)!.conversions += 1;
    const hv = hourMap.get(h)!;
    hv.conversions += 1;
    hv.revenue += d.amount_total || 0;
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
    if (d.win || wonStageIds.has(canonicalDealStageId(d)) || isWonRDStageName(d.rd_stage_name)) cur.wins += 1;
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
    bottleneck: (() => {
      const item = stageConversion.find((entry) => entry.isBottleneck);
      return item ? { from: item.from, to: item.to, lossPct: Number(item.lossPct) || 0 } : null;
    })(),
    sourceBreakdown,
    lostReasons,
    standbyReasons,
    stateBreakdown,
    weekdayBreakdown,
    hourBreakdown,
    ownerBreakdown,
  };
}
