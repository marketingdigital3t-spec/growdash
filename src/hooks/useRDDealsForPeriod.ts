import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { endOfDay, format, startOfDay } from "date-fns";
import { isWonRDStageName } from "@/lib/rdDealStatus";

export interface RDDealLite {
  id: string;
  rd_deal_id: string;
  ad_account_id: string | null;
  rd_funnel_id: string | null;
  rd_stage_id: string | null;
  rd_stage_name: string | null;
  rd_stage_order: number | null;
  stage_bucket: string;
  win: boolean;
  lost_reason: string | null;
  amount_total: number | null;
  amount_total_effective?: number | null;
  amount_total_original?: number | null;
  amount_total_manual?: number | null;
  manual_override_enabled?: boolean;
  manual_override_reason?: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id?: string | null;
  meta_lead_id?: string | null;
  meta_form_id?: string | null;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  meta_ad_id?: string | null;
  meta_attribution_method?: string | null;
  contact_name: string | null;
  contact_email: string | null;
  lead_state: string | null;
  lead_city: string | null;
  lead_created_at: string | null;
  stage_updated_at: string | null;
  closed_at: string | null;
  rd_product_name: string | null;
  deal_owner_name: string | null;
  first_touch_utm_campaign: string | null;
  last_touch_utm_campaign: string | null;
  rd_campaign_name: string | null;
  custom_fields?: Record<string, string> | null;
  updated_at?: string | null;
}

/**
 * A deal is an RD resource, not a pipeline card. If an integration was
 * relinked or a historical sync retried, a repeated copy must never double a
 * consolidated KPI. Keep the most recently updated representation of each RD
 * deal so all pages use the same set semantics.
 */
export function dedupeRDDeals<T extends RDDealLite>(rows: T[]) {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = row.rd_deal_id || row.id;
    const current = unique.get(key);
    const rowTime = new Date(row.updated_at || row.stage_updated_at || row.closed_at || row.lead_created_at || 0).getTime();
    const currentTime = current ? new Date(current.updated_at || current.stage_updated_at || current.closed_at || current.lead_created_at || 0).getTime() : -Infinity;
    if (!current || rowTime >= currentTime) unique.set(key, row);
  }
  return Array.from(unique.values());
}

interface Params {
  startDate: Date;
  endDate: Date;
  adAccountId?: string;
  /**
   * Used by multi-account views. Unlike an omitted account filter, this keeps
   * unassigned RD deals out of an advertising-account total.
   */
  adAccountIds?: string[];
  enabled?: boolean;
}

const FIELDS =
  "id, rd_deal_id, ad_account_id, rd_funnel_id, rd_stage_id, rd_stage_name, rd_stage_order, stage_bucket, win, lost_reason, amount_total, amount_total_original, amount_total_manual, amount_total_effective, manual_override_enabled, manual_override_reason, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id, meta_lead_id, meta_form_id, meta_campaign_id, meta_adset_id, meta_ad_id, meta_attribution_method, contact_name, contact_email, lead_state, lead_city, lead_created_at, stage_updated_at, closed_at, rd_product_name, deal_owner_name, first_touch_utm_campaign, last_touch_utm_campaign, custom_fields, updated_at";

export function useRDDealsForPeriod({ startDate, endDate, adAccountId, adAccountIds, enabled = true }: Params) {
  return useQuery({
    queryKey: [
      "rd_deals_period",
      format(startDate, "yyyy-MM-dd"),
      format(endDate, "yyyy-MM-dd"),
      adAccountId ?? "all",
      adAccountIds?.slice().sort().join(",") ?? "",
    ],
    enabled,
    queryFn: async () => {
      // Calendar selections are local-midnight dates. Expand the bounds to the
      // complete local days before comparing timestamptz columns; otherwise a
      // custom interval silently drops every deal created later on its end date.
      const rangeStart = startOfDay(startDate).toISOString();
      const rangeEnd = endOfDay(endDate).toISOString();
      const PAGE = 1000;
      let all: RDDealLite[] = [];
      // The date interval is already constrained by the user. Stop only when
      // the database has no further page, never at an arbitrary record cap.
      for (let p = 0; ; p++) {
        let q = supabase
          .from("rd_deals")
          .select(FIELDS)
          // Some older RD imports do not have lead_created_at. They are still
          // leads and must be included using the timestamp available for the
          // deal, rather than disappearing from expert and funnel totals.
          .or(`and(lead_created_at.gte.${rangeStart},lead_created_at.lte.${rangeEnd}),and(lead_created_at.is.null,stage_updated_at.gte.${rangeStart},stage_updated_at.lte.${rangeEnd}),and(lead_created_at.is.null,stage_updated_at.is.null,closed_at.gte.${rangeStart},closed_at.lte.${rangeEnd})`)
          .order("lead_created_at", { ascending: false });
        if (adAccountId) q = q.eq("ad_account_id", adAccountId);
        // An empty selection means "all accounts". Passing [] to PostgREST
        // generates an invalid `in.()` filter and makes the module fail to
        // load for users whose filters have not been initialized yet.
        else if (adAccountIds?.length) q = q.in("ad_account_id", adAccountIds);
        const from = p * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await q.range(from, to);
        // Algumas respostas grandes do PostgREST falham no offset seguinte
        // com 500 apesar de a página anterior ter sido entregue com sucesso.
        // Nunca descarte negociações reais já sincronizadas por uma falha de
        // paginação posterior: mantenha o conjunto válido e deixe o próximo
        // refetch buscar a continuação. Só falhe quando nenhuma página pôde
        // ser obtida, pois nesse caso não há uma base confiável para exibir.
        if (error) {
          if (p > 0 && all.length > 0) {
            console.warn("[useRDDealsForPeriod] página posterior indisponível; mantendo dados já carregados", error);
            break;
          }
          throw error;
        }
        const batch = ((data ?? []) as any[]).map((d): RDDealLite => ({
          ...d,
          rd_campaign_name: d.last_touch_utm_campaign ?? d.first_touch_utm_campaign ?? d.utm_campaign ?? null,
        }));
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }
      return dedupeRDDeals(all);
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Base de faturamento do RD: negócio ganho pertence ao período em que foi
 * fechado. Para integrações antigas que ainda não preenchem `closed_at`, a
 * última alteração de etapa é o fallback para não ocultar vendas reais.
 */
export function useRDWonDealsForPeriod({ startDate, endDate, adAccountId, adAccountIds, enabled = true }: Params) {
  return useQuery({
    queryKey: ["rd_won_deals_period", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), adAccountId ?? "all", adAccountIds?.slice().sort().join(",") ?? ""],
    enabled,
    queryFn: async () => {
      const rangeStart = startOfDay(startDate).toISOString();
      const rangeEnd = endOfDay(endDate).toISOString();
      const PAGE = 1000;
      const fetchAll = async (fallbackToStageUpdate: boolean) => {
        let rows: RDDealLite[] = [];
        for (let page = 0; ; page += 1) {
          let query = supabase
            .from("rd_deals")
            .select(FIELDS)
            .order(fallbackToStageUpdate ? "stage_updated_at" : "closed_at", { ascending: false, nullsFirst: false });
          query = fallbackToStageUpdate
            ? query.is("closed_at", null).gte("stage_updated_at", rangeStart).lte("stage_updated_at", rangeEnd)
            : query.gte("closed_at", rangeStart).lte("closed_at", rangeEnd);
          if (adAccountId) query = query.eq("ad_account_id", adAccountId);
          else if (adAccountIds?.length) query = query.in("ad_account_id", adAccountIds);
          const { data, error } = await query.range(page * PAGE, (page + 1) * PAGE - 1);
          if (error) {
            if (page > 0 && rows.length > 0) {
              console.warn("[useRDWonDealsForPeriod] página posterior indisponível; mantendo vendas já carregadas", error);
              break;
            }
            throw error;
          }
          const batch = ((data ?? []) as any[]).map((deal): RDDealLite => ({
            ...deal,
            rd_campaign_name: deal.last_touch_utm_campaign ?? deal.first_touch_utm_campaign ?? deal.utm_campaign ?? null,
          }));
          rows = rows.concat(batch);
          if (batch.length < PAGE) break;
        }
        return rows;
      };
      // PostgREST's nested `or(and(...),and(...))` became unreliable for
      // timestamp filters in production. Fetch the two disjoint ranges
      // explicitly: closed deals first, then the historical fallback.
      const all = (await fetchAll(false)).concat(await fetchAll(true));
      return dedupeRDDeals(all).filter((deal) => classifyLead(deal) === "won");
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Base operacional do CRM. Diferente dos relatórios, ela não corta negócios
 * pela data de criação: um lead antigo que continua aberto precisa permanecer
 * visível no pipeline, exatamente como no RD Station.
 */
export function useRDCRMDeals(adAccountId?: string, enabled = true, adAccountIds?: string[]) {
  return useQuery({
    queryKey: ["rd_crm_deals", adAccountId ?? "all", adAccountIds?.slice().sort().join(",") ?? ""],
    enabled,
    queryFn: async () => {
      const pageSize = 1_000;
      let all: RDDealLite[] = [];

      // Continue until Supabase returns a short page. A fixed page ceiling
      // silently hid older negotiations for larger RD pipelines.
      for (let page = 0; ; page += 1) {
        let query = supabase
          .from("rd_deals")
          .select(FIELDS)
          .order("stage_updated_at", { ascending: false, nullsFirst: false })
          .order("lead_created_at", { ascending: false, nullsFirst: false });
        if (adAccountId) query = query.eq("ad_account_id", adAccountId);
        else if (adAccountIds) query = query.in("ad_account_id", adAccountIds);

        const from = page * pageSize;
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) {
          if (page > 0 && all.length > 0) {
            console.warn("[useRDCRMDeals] página posterior indisponível; mantendo negociações já carregadas", error);
            break;
          }
          throw error;
        }
        const batch = ((data ?? []) as any[]).map((deal): RDDealLite => ({
          ...deal,
          rd_campaign_name: deal.last_touch_utm_campaign
            ?? deal.first_touch_utm_campaign
            ?? deal.utm_campaign
            ?? null,
        }));
        all = all.concat(batch);
        if (batch.length < pageSize) break;
      }

      return dedupeRDDeals(all);
    },
    staleTime: 15 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
  });
}

export type LeadBucket = "won" | "lost" | "disqualified" | "qualified" | "open";

const DISQUALIFIED_KEYWORDS = ["desqualif", "não qualif", "nao qualif", "unqualified", "unqualif"];
const QUALIFIED_BUCKETS = new Set(["sql", "opportunity", "client"]);

export function classifyLead(deal: RDDealLite): LeadBucket {
  if (deal.win || isWonRDStageName(deal.rd_stage_name)) return "won";
  const stageName = (deal.rd_stage_name || "").toLowerCase();
  const reason = (deal.lost_reason || "").toLowerCase();
  const isDisqualified =
    DISQUALIFIED_KEYWORDS.some((k) => reason.includes(k)) ||
    DISQUALIFIED_KEYWORDS.some((k) => stageName.includes(k));
  if (deal.stage_bucket === "lost") {
    return isDisqualified ? "disqualified" : "lost";
  }
  if (isDisqualified) return "disqualified";
  if (QUALIFIED_BUCKETS.has(deal.stage_bucket)) return "qualified";
  return "open";
}
