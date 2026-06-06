import type { InsightRow } from "@/hooks/useInsights";

export function aggregateMetrics(rows: InsightRow[]) {
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);

  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCTR = rows.length > 0 ? rows.reduce((s, r) => s + r.ctr, 0) / rows.length : 0;
  const avgCPM = rows.length > 0 ? rows.reduce((s, r) => s + r.cpm, 0) / rows.length : 0;
  const conversionRate = totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0;
  const efficiencyRate = totalImpressions > 0 ? (totalLeads / totalImpressions) * 100 : 0;

  return { totalSpend, totalLeads, avgCPL, avgCTR, avgCPM, conversionRate, efficiencyRate };
}

export function calculateVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function getHealthColor(score: number) {
  if (score >= 80) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

export function getHealthBadge(score: number) {
  if (score >= 80) return { label: "Saudável", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
  if (score >= 50) return { label: "Atenção", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
  return { label: "Crítico", color: "bg-red-500/10 text-red-600 border-red-500/20" };
}

export function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical": return "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400";
    case "warning": return "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
    default: return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
  }
}

export function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical": return "🔴";
    case "warning": return "🟡";
    default: return "🟢";
  }
}

/** Group insights by date and sum values */
export function groupByDate(rows: InsightRow[]) {
  const map = new Map<string, { date: string; spend: number; leads: number; cpl: number; clicks: number; impressions: number; ctr: number }>();
  for (const r of rows) {
    const existing = map.get(r.date) || { date: r.date, spend: 0, leads: 0, cpl: 0, clicks: 0, impressions: 0, ctr: 0 };
    existing.spend += r.spend;
    existing.leads += r.leads;
    existing.clicks += r.clicks;
    existing.impressions += r.impressions;
    map.set(r.date, existing);
  }
  return Array.from(map.values()).map((d) => ({
    ...d,
    cpl: d.leads > 0 ? d.spend / d.leads : 0,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
    conversion: d.clicks > 0 ? (d.leads / d.clicks) * 100 : 0,
  }));
}

/** Group by ad name for CTR by creative chart */
export function groupByCreative(rows: InsightRow[]) {
  const map = new Map<string, { name: string; totalClicks: number; totalImpressions: number }>();
  for (const r of rows) {
    const existing = map.get(r.ad_name) || { name: r.ad_name, totalClicks: 0, totalImpressions: 0 };
    existing.totalClicks += r.clicks;
    existing.totalImpressions += r.impressions;
    map.set(r.ad_name, existing);
  }
  return Array.from(map.values()).map((d) => ({
    name: d.name.length > 25 ? d.name.slice(0, 25) + "…" : d.name,
    ctr: d.totalImpressions > 0 ? (d.totalClicks / d.totalImpressions) * 100 : 0,
  }));
}
