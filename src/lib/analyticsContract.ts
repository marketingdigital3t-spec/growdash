import type { MetaTrafficMetrics } from "@/lib/metaTraffic";
import type { RDDeal } from "@/hooks/useRDDeals";
import type { Sale } from "@/hooks/useSales";
import { canonicalWonDealsInPeriod } from "@/lib/canonicalMetrics";
import { dedupeCanonicalSales } from "@/lib/canonicalSales";

export type MetricSource = "meta" | "rd" | "sales" | "finance" | "derived";
export type AnalyticsSyncState = "fresh" | "syncing" | "stale" | "partial" | "error";

export type MetaSyncBlock = "insights" | "actions" | "hourly" | "breakdowns";

export interface MetaSyncBlockStatus {
  status: AnalyticsSyncState | "pending";
  requestedScope?: GlobalAnalyticsScope;
  coveredScope?: { startDate: string | null; endDate: string | null };
  pagesProcessed?: number;
  lastAttemptAt?: string | null;
  lastValidSnapshotAt?: string | null;
  errorCode?: string | number | null;
  errorMessage?: string | null;
}

export interface GlobalAnalyticsScope {
  adAccountIds: string[];
  funnelIds: string[];
  campaignIds: string[];
  startDate: string;
  endDate: string;
  timezoneByAccount: Record<string, string>;
  attributionWindowByAccount: Record<string, string>;
}

export interface MetricValue<T extends number = number> {
  value: T | null;
  available: boolean;
  source: MetricSource;
  reason?: string;
  /** True when the provider returns a non-deduplicated aggregation. */
  directional?: boolean;
}

export interface AnalyticsSyncStatus {
  status: AnalyticsSyncState;
  syncedAt: string | null;
  lastValidSnapshotAt: string | null;
  coveredAccounts: string[];
  failedAccounts: string[];
  coveredFunnels: string[];
  failedFunnels: string[];
  requestedScope: GlobalAnalyticsScope;
  errors: string[];
  blocks?: Partial<Record<MetaSyncBlock, MetaSyncBlockStatus>>;
  pagesProcessed?: number;
  lastAttemptAt?: string | null;
}

export interface MetaMetricContract {
  spend: MetricValue;
  dailySpend: MetricValue;
  impressions: MetricValue;
  reach: MetricValue;
  frequency: MetricValue;
  clicks: MetricValue;
  ctr: MetricValue;
  cpc: MetricValue;
  cpm: MetricValue;
  formLeads: MetricValue;
  siteLeads: MetricValue;
  conversations: MetricValue;
  totalLeads: MetricValue;
  cpl: MetricValue;
  results: MetricValue;
  purchases: MetricValue;
  checkout: MetricValue;
  purchaseValue: MetricValue;
  roas: MetricValue;
  spendByAccount: Record<string, MetricValue>;
}

export interface RDMetricContract {
  createdDeals: MetricValue;
  activePipeline: MetricValue;
  opportunities: MetricValue;
  wonDeals: MetricValue;
  conversionRate: MetricValue;
  revenuePotential: MetricValue;
}

export interface SalesMetricContract {
  confirmedSales: MetricValue;
  grossRevenue: MetricValue;
  netRevenue: MetricValue;
  averageTicket: MetricValue;
  cashReceived: MetricValue;
  salesWithoutRDLink: MetricValue;
}

export interface FinanceMetricContract {
  operationalExpenses: MetricValue;
  profit: MetricValue;
  margin: MetricValue;
  bankBalance: MetricValue;
}

export interface AnalyticsMetricContract {
  version: 1;
  scope: GlobalAnalyticsScope;
  meta: MetaMetricContract;
  rd: RDMetricContract;
  sales: SalesMetricContract;
  finance: FinanceMetricContract;
  sync: AnalyticsSyncStatus;
}

export function metricValue(value: number | null, available: boolean, source: MetricSource, reason?: string, directional?: boolean): MetricValue {
  return { value: available && value !== null && Number.isFinite(value) ? value : null, available, source, ...(available ? {} : { reason: reason || "Dados indisponíveis para o escopo selecionado." }), ...(directional ? { directional: true } : {}) };
}

/** Convert the legacy numeric Meta domain into the availability-aware contract. */
export function metaMetricContract(meta: MetaTrafficMetrics): MetaMetricContract {
  const available = meta.rowCount > 0;
  const reason = meta.unavailableReason || undefined;
  const leadAvailable = available && !!meta.metricAvailability.leads?.available;
  const derived = (value: number, source: MetricSource = "derived") => metricValue(value, available, source, reason);
  return {
    spend: derived(meta.spend, "meta"), dailySpend: derived(meta.dailySpend, "meta"),
    impressions: derived(meta.impressions, "meta"), reach: { ...derived(meta.reach, "meta"), directional: true },
    frequency: derived(meta.frequency, "meta"), clicks: derived(meta.clicks, "meta"),
    ctr: derived(meta.ctr, "meta"), cpc: derived(meta.cpc, "meta"), cpm: derived(meta.cpm, "meta"),
    formLeads: metricValue(meta.formLeads, leadAvailable, "meta", reason || "Ações Meta ainda não confirmadas."),
    siteLeads: metricValue(meta.siteLeads, leadAvailable, "meta", reason || "Ações Meta ainda não confirmadas."),
    conversations: metricValue(meta.conversations, leadAvailable, "meta", reason || "Ações Meta ainda não confirmadas."),
    totalLeads: metricValue(meta.totalLeads, leadAvailable, "meta", reason || "Ações Meta ainda não confirmadas."),
    cpl: metricValue(meta.cpl, leadAvailable, "meta", reason || "Ações Meta ainda não confirmadas."),
    results: derived(meta.results, "meta"), purchases: derived(meta.purchases, "meta"),
    checkout: derived(meta.checkout, "meta"), purchaseValue: derived(meta.purchaseValue, "meta"), roas: derived(meta.roas, "meta"),
    spendByAccount: Object.fromEntries(Object.entries(meta.spendByAccount || {}).map(([accountId, value]) => [accountId, metricValue(value, available, "meta", reason)])),
  };
}

export function rdMetricContract(args: { allDeals: RDDeal[]; createdInPeriod: RDDeal[]; wonInPeriod: RDDeal[]; opportunities: number; available: boolean; reason?: string }): RDMetricContract {
  const source = "rd" as const;
  const value = (n: number, reason = args.reason) => metricValue(n, args.available, source, reason);
  const wonCount = args.wonInPeriod.length;
  return {
    createdDeals: value(args.createdInPeriod.length),
    activePipeline: value(args.allDeals.length),
    opportunities: value(args.opportunities),
    wonDeals: value(wonCount),
    conversionRate: value(args.createdInPeriod.length ? wonCount / args.createdInPeriod.length * 100 : 0),
    revenuePotential: value(args.allDeals.filter((deal) => !deal.win).reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0)),
  };
}

export function canonicalRDMetrics(deals: RDDeal[], start: Date, end: Date) {
  const allDeals = dedupeRDByConnection(deals);
  const wonInPeriod = canonicalWonDealsInPeriod(allDeals, start, end);
  return { allDeals, wonInPeriod };
}

function dedupeRDByConnection<T extends RDDeal>(rows: T[]): T[] {
  const newest = new Map<string, T>();
  for (const row of rows) {
    if (!row.rd_deal_id) continue;
    const key = `${row.rd_connection_id || "legacy"}:${row.rd_deal_id}`;
    const current = newest.get(key);
    const stamp = Date.parse(row.updated_at || row.stage_updated_at || row.lead_created_at || "") || 0;
    const previous = current ? Date.parse(current.updated_at || current.stage_updated_at || current.lead_created_at || "") || 0 : -1;
    if (!current || stamp >= previous) newest.set(key, row);
  }
  return [...newest.values()];
}

export function salesMetricContract(sales: Sale[], available: boolean, reason?: string): SalesMetricContract {
  const confirmed = dedupeCanonicalSales(sales.filter((sale) => sale.status === "confirmed"));
  const gross = confirmed.reduce((sum, sale) => sum + Number(sale.gross_revenue || 0), 0);
  const net = confirmed.reduce((sum, sale) => sum + Number(sale.net_revenue || 0), 0);
  const notRDLinked = confirmed.filter((sale) => !sale.rd_deal_id).length;
  const metric = (value: number) => metricValue(value, available, "sales", reason);
  return {
    confirmedSales: metric(confirmed.reduce((sum, sale) => sum + Math.max(1, Number(sale.quantity || 1)), 0)),
    grossRevenue: metric(gross), netRevenue: metric(net),
    averageTicket: metric(confirmed.length ? net / confirmed.length : 0),
    // The current `sales` schema has no received amount/date. Do not claim that
    // gross/net revenue is cash until that source field is introduced.
    cashReceived: metricValue(null, false, "sales", "A tabela sales ainda não possui valor e data de recebimento canônicos."),
    salesWithoutRDLink: metric(notRDLinked),
  };
}

export function financeMetricContract(args: { expenses: number | null; revenue: number | null; mediaSpend: number | null; bankBalance: number | null; available: boolean; reason?: string }): FinanceMetricContract {
  const metric = (value: number | null) => metricValue(value, args.available && value !== null, "finance", args.reason);
  const profit = args.revenue === null || args.expenses === null || args.mediaSpend === null ? null : args.revenue - args.expenses - args.mediaSpend;
  const margin = profit === null || args.revenue === null || args.revenue === 0 ? null : profit / args.revenue * 100;
  return { operationalExpenses: metric(args.expenses), profit: metric(profit), margin: metric(margin), bankBalance: metric(args.bankBalance) };
}
