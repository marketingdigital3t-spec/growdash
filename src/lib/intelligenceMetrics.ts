import type { InsightRow } from "@/hooks/useInsights";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { Sale } from "@/hooks/useSales";

export type MetricSource = "meta" | "rd" | "sales" | "finance";
export type DataStateKind = "loading" | "error" | "empty" | "no-data" | "ready" | "stale";
export type Severity = "info" | "warning" | "critical";

export interface AccountMetricContext {
  id: string;
  name: string;
  timezone: string;
  attributionWindow: string;
  dailyBudget: number;
  remainingBalance: number;
  targetCpl: number;
  lastSyncAt: string | null;
  oauthStatus: string;
}

export interface UnifiedMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  rdLeads: number;
  qualifiedLeads: number;
  sales: number;
  revenue: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpl: number;
  cac: number;
  roas: number;
  frequency: number;
  conversionRate: number;
  rdCoverage: number;
}

export interface MetricAnomaly {
  metric: keyof UnifiedMetrics;
  severity: Severity;
  title: string;
  message: string;
  current: number;
  baseline: number;
  changePct: number;
  action: string;
}

export interface BudgetPacing {
  dailyBudget: number;
  averageDailySpend: number;
  projectedMonthSpend: number;
  remainingBalance: number;
  autonomyDays: number;
  recommendedRecharge: number;
  status: "healthy" | "attention" | "critical";
}

export interface ForecastScenario {
  key: "conservative" | "probable" | "aggressive";
  label: string;
  investment: number;
  leads: number;
  sales: number;
  revenue: number;
  cac: number;
}

const safe = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const ratio = (numerator: number, denominator: number, factor = 1) => denominator > 0 ? (numerator / denominator) * factor : 0;

export function aggregateUnifiedMetrics(insights: InsightRow[], deals: RDDealLite[], salesRows: Sale[]): UnifiedMetrics {
  const media = insights.reduce((acc, row) => ({
    spend: acc.spend + safe(row.spend),
    impressions: acc.impressions + safe(row.impressions),
    reach: acc.reach + safe(row.reach),
    clicks: acc.clicks + safe(row.clicks),
    leads: acc.leads + safe(row.leads),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 });
  const validSales = salesRows.filter((sale) => sale.status === "confirmed" || sale.status === "pending");
  const sales = validSales.reduce((sum, sale) => sum + Math.max(0, safe(sale.quantity)), 0);
  const revenue = validSales.reduce((sum, sale) => sum + safe(sale.net_revenue), 0);
  const qualifiedLeads = deals.filter((deal) => deal.win || ["sql", "opportunity", "client"].includes(deal.stage_bucket)).length;

  return {
    ...media,
    rdLeads: deals.length,
    qualifiedLeads,
    sales,
    revenue,
    ctr: ratio(media.clicks, media.impressions, 100),
    cpm: ratio(media.spend, media.impressions, 1_000),
    cpc: ratio(media.spend, media.clicks),
    cpl: ratio(media.spend, media.leads),
    cac: ratio(media.spend, sales),
    roas: ratio(revenue, media.spend),
    frequency: ratio(media.impressions, media.reach),
    conversionRate: ratio(sales, deals.length || media.leads, 100),
    rdCoverage: ratio(deals.length, media.leads, 100),
  };
}

export function metricsByDay(insights: InsightRow[]): Array<{ date: string; metrics: UnifiedMetrics }> {
  const grouped = new Map<string, InsightRow[]>();
  insights.forEach((row) => grouped.set(row.date, [...(grouped.get(row.date) || []), row]));
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
    date,
    metrics: aggregateUnifiedMetrics(rows, [], []),
  }));
}

export function detectAnomalies(insights: InsightRow[], targetCpl = 0): MetricAnomaly[] {
  const days = metricsByDay(insights);
  if (days.length < 2) return [];
  const recent = days.slice(-Math.min(3, days.length));
  const baselineRows = days.slice(0, -recent.length);
  const baseline = baselineRows.length ? baselineRows : days.slice(0, -1);
  const average = (rows: typeof days, metric: keyof UnifiedMetrics) => ratio(rows.reduce((sum, row) => sum + safe(row.metrics[metric]), 0), rows.length);
  const configs: Array<{ metric: keyof UnifiedMetrics; bad: "up" | "down"; threshold: number; label: string; action: string }> = [
    { metric: "cpl", bad: "up", threshold: 20, label: "CPL", action: "Revise público, criativo e evento de conversão antes de escalar." },
    { metric: "ctr", bad: "down", threshold: 20, label: "CTR", action: "Teste novo gancho, promessa e primeira dobra do criativo." },
    { metric: "cpm", bad: "up", threshold: 25, label: "CPM", action: "Avalie saturação, sobreposição de público e posicionamentos." },
    { metric: "frequency", bad: "up", threshold: 20, label: "Frequência", action: "Renove criativos e amplie a audiência qualificada." },
  ];
  const anomalies = configs.flatMap<MetricAnomaly>((config) => {
    const current = average(recent, config.metric);
    const base = average(baseline, config.metric);
    if (!base || !current) return [];
    const changePct = ratio(current - base, base, 100);
    const isBad = config.bad === "up" ? changePct >= config.threshold : changePct <= -config.threshold;
    if (!isBad) return [];
    return [{
      metric: config.metric,
      severity: Math.abs(changePct) >= 40 ? "critical" : "warning",
      title: `${config.label} fora do padrão`,
      message: `${config.label} variou ${Math.abs(changePct).toFixed(1)}% contra a base anterior.`,
      current,
      baseline: base,
      changePct,
      action: config.action,
    }];
  });
  const currentCpl = recent.at(-1)?.metrics.cpl || 0;
  if (targetCpl > 0 && currentCpl > targetCpl * 1.15 && !anomalies.some((item) => item.metric === "cpl")) {
    anomalies.push({ metric: "cpl", severity: currentCpl > targetCpl * 1.4 ? "critical" : "warning", title: "CPL acima da meta", message: `CPL atual ${currentCpl.toFixed(2)} versus meta ${targetCpl.toFixed(2)}.`, current: currentCpl, baseline: targetCpl, changePct: ratio(currentCpl - targetCpl, targetCpl, 100), action: "Reduza desperdício e concentre verba nos conjuntos abaixo do CPL-alvo." });
  }
  return anomalies;
}

export function calculateBudgetPacing(metrics: UnifiedMetrics, context: Pick<AccountMetricContext, "dailyBudget" | "remainingBalance">, elapsedDays: number, daysInMonth = 30): BudgetPacing {
  const averageDailySpend = ratio(metrics.spend, Math.max(1, elapsedDays));
  const plannedDaily = context.dailyBudget || averageDailySpend;
  const projectedMonthSpend = averageDailySpend * daysInMonth;
  const autonomyDays = averageDailySpend > 0 ? context.remainingBalance / averageDailySpend : 0;
  const recommendedRecharge = Math.max(0, averageDailySpend * 7 - context.remainingBalance);
  const status = context.remainingBalance <= 0 || (autonomyDays > 0 && autonomyDays < 2) ? "critical" : autonomyDays < 7 || averageDailySpend > plannedDaily * 1.15 ? "attention" : "healthy";
  return { dailyBudget: plannedDaily, averageDailySpend, projectedMonthSpend, remainingBalance: context.remainingBalance, autonomyDays, recommendedRecharge, status };
}

export function buildForecastScenarios(metrics: UnifiedMetrics, investment: number): ForecastScenario[] {
  const cpl = metrics.cpl || (investment > 0 ? investment / Math.max(1, metrics.leads) : 0);
  const leadToSale = ratio(metrics.sales, metrics.leads);
  const ticket = ratio(metrics.revenue, metrics.sales);
  return [
    { key: "conservative", label: "Conservador", multiplier: 0.78 },
    { key: "probable", label: "Provável", multiplier: 1 },
    { key: "aggressive", label: "Agressivo", multiplier: 1.22 },
  ].map(({ key, label, multiplier }) => {
    const scenarioInvestment = investment * multiplier;
    const leads = cpl > 0 ? scenarioInvestment / (cpl * (key === "aggressive" ? 1.12 : key === "conservative" ? 0.96 : 1)) : 0;
    const sales = leads * leadToSale;
    return { key, label, investment: scenarioInvestment, leads, sales, revenue: sales * ticket, cac: ratio(scenarioInvestment, sales) } as ForecastScenario;
  });
}

export function detectCreativeFatigue(insights: InsightRow[]) {
  const grouped = new Map<string, InsightRow[]>();
  insights.forEach((row) => grouped.set(row.ad_id, [...(grouped.get(row.ad_id) || []), row]));
  return [...grouped.entries()].map(([adId, rows]) => {
    const current = rows.slice(-3);
    const previous = rows.slice(0, -3);
    const now = aggregateUnifiedMetrics(current, [], []);
    const before = aggregateUnifiedMetrics(previous, [], []);
    const fatigueScore = Math.min(100, Math.max(0,
      (now.frequency >= 3 ? 35 : now.frequency * 8) +
      (before.ctr > 0 && now.ctr < before.ctr ? Math.min(35, ratio(before.ctr - now.ctr, before.ctr, 35)) : 0) +
      (before.cpm > 0 && now.cpm > before.cpm ? Math.min(30, ratio(now.cpm - before.cpm, before.cpm, 30)) : 0),
    ));
    return { adId, name: rows.at(-1)?.ad_name || adId, fatigueScore, frequency: now.frequency, ctr: now.ctr, cpm: now.cpm, needsReplacement: fatigueScore >= 55 };
  }).sort((a, b) => b.fatigueScore - a.fatigueScore);
}

export function buildPlaybooks(anomalies: MetricAnomaly[], pacing: BudgetPacing) {
  const items = anomalies.map((anomaly) => ({ severity: anomaly.severity, title: `Playbook: ${anomaly.title}`, trigger: anomaly.message, actions: [anomaly.action, "Acompanhar por 24 horas e comparar com a mesma janela anterior.", "Registrar a decisão para permitir rollback."] }));
  if (pacing.status !== "healthy") items.push({ severity: pacing.status === "critical" ? "critical" as const : "warning" as const, title: "Playbook: continuidade de verba", trigger: `Autonomia estimada em ${pacing.autonomyDays.toFixed(1)} dia(s).`, actions: [`Programar aporte de ${pacing.recommendedRecharge.toFixed(2)} para sete dias de cobertura.`, "Confirmar saldo e limite da conta antes de alterar orçamento.", "Priorizar campanhas abaixo do CPL-alvo."] });
  return items;
}

export function resolveDataState(input: { loading: boolean; error?: unknown; hasConfiguredSource: boolean; rows: number; lastSyncAt?: string | null }): DataStateKind {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (!input.hasConfiguredSource) return "empty";
  if (input.rows === 0) return "no-data";
  if (input.lastSyncAt && Date.now() - new Date(input.lastSyncAt).getTime() > 30 * 60 * 1000) return "stale";
  return "ready";
}
