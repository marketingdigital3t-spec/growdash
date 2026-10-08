import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isWonRDStageName } from "@/lib/rdDealStatus";
import { isCanonicalWonDealInPeriod, saoPauloDayBounds } from "@/lib/canonicalMetrics";
import { canQueryResolvedRDAccountScope, isRDDealInScopePeriod } from "@/lib/rdQueryScope";
import { withRequestTimeout } from "@/lib/resilience";
import { businessDateKey } from "@/lib/businessDate";
import { useResolvedRDAccountFunnelScope } from "@/hooks/useResolvedRDAccountFunnelScope";

export interface RDDealLite {
  id: string;
  rd_deal_id: string;
  rd_connection_id?: string | null;
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
    // A provider identity is required for a CRM fact. Rows without
    // rd_deal_id are incomplete sync artifacts and must not inflate a lead
    // count or be treated as independent deals by their local row id.
    const providerId = String(row.rd_deal_id || "").trim();
    if (!providerId) continue;
    const key = `${row.rd_connection_id || row.ad_account_id || "legacy"}:${providerId}`;
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
  funnelIds?: string[];
  enabled?: boolean;
}

interface WonDealsParams extends Omit<Params, "startDate" | "endDate"> {
  startDate?: Date;
  endDate?: Date;
  allHistory?: boolean;
}

export interface RDCRMQueryScope {
  adAccountId?: string;
  adAccountIds?: string[];
  funnelIds?: string[];
  startDate?: Date;
  endDate?: Date;
  dateScope?: "pipeline" | "period";
  enabled?: boolean;
}

export function rdLeadCreatedAtRange(startDate?: Date, endDate?: Date) {
  if (!startDate || !endDate) return null;
  const bounds = saoPauloDayBounds(startDate, endDate);
  return { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
}

const FIELDS =
  "id, rd_deal_id, rd_connection_id, ad_account_id, rd_funnel_id, rd_stage_id, rd_stage_name, rd_stage_order, stage_bucket, win, lost_reason, amount_total, amount_total_original, amount_total_manual, amount_total_effective, manual_override_enabled, manual_override_reason, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id, meta_lead_id, meta_form_id, meta_campaign_id, meta_adset_id, meta_ad_id, meta_attribution_method, contact_name, contact_email, lead_state, lead_city, lead_created_at, stage_updated_at, closed_at, rd_product_name, deal_owner_name, first_touch_utm_campaign, last_touch_utm_campaign, custom_fields, updated_at";

export function useRDDealsForPeriod({ startDate, endDate, adAccountId, adAccountIds, funnelIds, enabled = true }: Params) {
  const rdScope = useResolvedRDAccountFunnelScope({ adAccountId, adAccountIds, funnelIds });
  const resolvedFunnelIds = rdScope.funnelIds;
  const query = useQuery({
    queryKey: [
      "rd_deals_period",
      businessDateKey(startDate),
      businessDateKey(endDate),
      resolvedFunnelIds?.join(",") ?? "all",
      rdScope.accountScoped ? (adAccountIds?.slice().sort().join(",") || adAccountId || "") : "",
    ],
    enabled: enabled && canQueryResolvedRDAccountScope(rdScope.accountScoped, rdScope.loading, resolvedFunnelIds),
    queryFn: async () => {
      if (rdScope.error) throw rdScope.error;
      // Calendar selections are local-midnight dates. Expand the bounds to the
      // complete local days before comparing timestamptz columns; otherwise a
      // custom interval silently drops every deal created later on its end date.
      const bounds = saoPauloDayBounds(startDate, endDate);
      const rangeStart = bounds.start.toISOString();
      const rangeEnd = bounds.end.toISOString();
      const PAGE = 1000;
      let all: RDDealLite[] = [];
      // The date interval is already constrained by the user. Stop only when
      // the database has no further page, never at an arbitrary record cap.
      for (let p = 0; ; p++) {
        let q = supabase
          .from("rd_deals")
          .select(FIELDS)
          // Fetch every timestamp that can establish the canonical period.
          // The final client-side selector below applies the business rule:
          // creation for open/lost, closing (or a real won-stage transition)
          // for won. In particular, a deal created months ago but closed in
          // the selected interval must not be lost by a lead_created filter.
          .or(`and(lead_created_at.gte.${rangeStart},lead_created_at.lte.${rangeEnd}),and(closed_at.gte.${rangeStart},closed_at.lte.${rangeEnd}),and(closed_at.is.null,stage_updated_at.gte.${rangeStart},stage_updated_at.lte.${rangeEnd})`)
          .order("lead_created_at", { ascending: false });
        if (resolvedFunnelIds?.length) q = q.in("rd_funnel_id", resolvedFunnelIds);
        const from = p * PAGE;
        const to = from + PAGE - 1;
        const { data, error } = await withRequestTimeout(q.range(from, to), 15_000);
        // Nunca transforme uma página ausente em um resultado aparentemente
        // completo: isso era a causa de contagens parciais no funil.
        if (error) throw error;
        const batch = ((data ?? []) as any[]).map((d): RDDealLite => ({
          ...d,
          rd_campaign_name: d.last_touch_utm_campaign ?? d.first_touch_utm_campaign ?? d.utm_campaign ?? null,
        }));
        all = all.concat(batch);
        if (batch.length < PAGE) break;
      }
      const scoped = all.filter((deal) => isRDDealInScopePeriod(deal, {
        accountIds: [],
        funnelIds: [],
        startDate,
        endDate,
        dateRule: "created_at_for_open_closed_at_for_won",
      }));
      return dedupeRDDeals(scoped);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  return { ...query, isLoading: query.isLoading || rdScope.loading, isFetching: query.isFetching || rdScope.loading, isError: query.isError || Boolean(rdScope.error), error: query.error ?? rdScope.error };
}

/**
 * Base de faturamento do RD: negócio ganho pertence ao período em que foi
 * fechado. Para integrações antigas que ainda não preenchem `closed_at`, a
 * última alteração de etapa é o fallback para não ocultar vendas reais.
 */
export function useRDWonDealsForPeriod({ startDate, endDate, adAccountId, adAccountIds, funnelIds, allHistory = false, enabled = true }: WonDealsParams) {
  const rdScope = useResolvedRDAccountFunnelScope({ adAccountId, adAccountIds, funnelIds });
  const resolvedFunnelIds = rdScope.funnelIds;
  const selectedAccountIds = Array.from(new Set([...(adAccountIds ?? []), ...(adAccountId ? [adAccountId] : [])].filter(Boolean)));
  const query = useQuery({
    queryKey: ["rd_won_deals_period", allHistory ? "all-history" : `${businessDateKey(startDate!)}:${businessDateKey(endDate!)}`, resolvedFunnelIds?.join(",") ?? "all", rdScope.accountScoped ? (adAccountIds?.slice().sort().join(",") || adAccountId || "") : ""],
    enabled: enabled && canQueryResolvedRDAccountScope(rdScope.accountScoped, rdScope.loading, resolvedFunnelIds),
    queryFn: async () => {
      if (rdScope.error) throw rdScope.error;
      if (!allHistory && (!startDate || !endDate)) throw new Error("Informe o período do RD Station.");
      const bounds = !allHistory && startDate && endDate ? saoPauloDayBounds(startDate, endDate) : null;
      const rangeStart = bounds?.start.toISOString();
      const rangeEnd = bounds?.end.toISOString();
      const PAGE = 1000;
      const fetchAll = async (fallbackToStageUpdate: boolean) => {
        let rows: RDDealLite[] = [];
        for (let page = 0; ; page += 1) {
          let query = supabase
            .from("rd_deals")
            .select(FIELDS)
            .order(fallbackToStageUpdate ? "stage_updated_at" : "closed_at", { ascending: false, nullsFirst: false });
          if (!allHistory) {
            query = fallbackToStageUpdate
              ? query.is("closed_at", null).gte("stage_updated_at", rangeStart!).lte("stage_updated_at", rangeEnd!)
              : query.gte("closed_at", rangeStart!).lte("closed_at", rangeEnd!);
          } else if (fallbackToStageUpdate) {
            query = query.is("closed_at", null);
          }
          // RD rows can be linked through a funnel/connection, or directly to
          // the advertising account. Keep both paths in the same account scope
          // so a direct CRM import is not lost when its funnel metadata is
          // missing or still being linked.
          if (resolvedFunnelIds?.length && resolvedFunnelIds[0] !== "__no_linked_rd_funnels__") {
            const funnelFilter = `rd_funnel_id.in.(${resolvedFunnelIds.join(",")})`;
            const accountFilter = selectedAccountIds.length ? `ad_account_id.in.(${selectedAccountIds.join(",")})` : "";
            query = query.or([funnelFilter, accountFilter].filter(Boolean).join(","));
          } else if (selectedAccountIds.length) {
            query = query.in("ad_account_id", selectedAccountIds);
          }
          const { data, error } = await withRequestTimeout(query.range(page * PAGE, (page + 1) * PAGE - 1), 15_000);
          if (error) throw error;
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
      // A won deal without both a close timestamp and a real stage transition
      // has no trustworthy sales date and must remain out of period KPIs.
      const deduped = dedupeRDDeals(all);
      return allHistory
        ? deduped.filter((deal) => deal.win || isWonRDStageName(deal.rd_stage_name))
        : deduped.filter((deal) => isCanonicalWonDealInPeriod(deal, startDate!, endDate!));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  return { ...query, isLoading: query.isLoading || rdScope.loading, isFetching: query.isFetching || rdScope.loading, isError: query.isError || Boolean(rdScope.error), error: query.error ?? rdScope.error };
}

/**
 * Base operacional do CRM. Diferente dos relatórios, ela não corta negócios
 * pela data de criação: um lead antigo que continua aberto precisa permanecer
 * visível no pipeline, exatamente como no RD Station.
 */
export function useRDCRMDeals({ adAccountId, adAccountIds, funnelIds, startDate, endDate, dateScope = "pipeline", enabled = true }: RDCRMQueryScope) {
  const rdScope = useResolvedRDAccountFunnelScope({ adAccountId, adAccountIds, funnelIds });
  const resolvedFunnelIds = rdScope.funnelIds;
  const funnelScope = resolvedFunnelIds?.join(",") ?? "all";
  const query = useQuery({
    queryKey: ["rd_crm_deals", funnelScope, rdScope.accountScoped ? (adAccountIds?.slice().sort().join(",") || adAccountId || "") : "", dateScope, dateScope === "period" && startDate ? businessDateKey(startDate) : null, dateScope === "period" && endDate ? businessDateKey(endDate) : null],
    enabled: enabled && canQueryResolvedRDAccountScope(rdScope.accountScoped, rdScope.loading, resolvedFunnelIds),
    queryFn: async () => {
      if (rdScope.error) throw rdScope.error;
      const periodBounds = dateScope === "period" ? rdLeadCreatedAtRange(startDate, endDate) : null;
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
        if (periodBounds) {
          query = query
            .gte("lead_created_at", periodBounds.start)
            .lte("lead_created_at", periodBounds.end);
        }
        if (resolvedFunnelIds?.length) query = query.in("rd_funnel_id", resolvedFunnelIds);
        const from = page * pageSize;
        const { data, error } = await withRequestTimeout(query.range(from, from + pageSize - 1), 15_000);
        if (error) throw error;
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
    staleTime: 5 * 60 * 1_000,
    gcTime: 24 * 60 * 60 * 1_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
  });
  return { ...query, isLoading: query.isLoading || rdScope.loading, isFetching: query.isFetching || rdScope.loading, isError: query.isError || Boolean(rdScope.error), error: query.error ?? rdScope.error };
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
