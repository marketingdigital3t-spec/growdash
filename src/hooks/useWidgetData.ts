import { useMemo } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import type { WidgetConfig, WidgetMetric, WidgetGroupBy } from "@/lib/widgetCatalog";
import { aggregateMetrics } from "@/lib/metrics";
import { aggregateSales } from "@/hooks/useSales";
import { format, parseISO } from "date-fns";

export function computeKpi(
  metric: WidgetMetric,
  insights: any[],
  sales: any[],
): { value: number; prefix?: string; suffix?: string; decimals: number } {
  const ad = aggregateMetrics(insights);
  const s = aggregateSales(sales);
  switch (metric) {
    case "spend":
      return { value: ad.totalSpend, prefix: "R$ ", decimals: 2 };
    case "leads":
      return { value: ad.totalLeads, decimals: 0 };
    case "cpl":
      return { value: ad.avgCPL, prefix: "R$ ", decimals: 2 };
    case "ctr":
      return { value: ad.avgCTR, suffix: "%", decimals: 2 };
    case "cpm":
      return { value: ad.avgCPM, prefix: "R$ ", decimals: 2 };
    case "clicks":
      return { value: insights.reduce((s: number, r: any) => s + (r.clicks ?? 0), 0), decimals: 0 };
    case "impressions":
      return { value: insights.reduce((s: number, r: any) => s + (r.impressions ?? 0), 0), decimals: 0 };
    case "frequency": {
      const arr = insights.filter((r: any) => r.frequency);
      return { value: arr.length ? arr.reduce((s: number, r: any) => s + r.frequency, 0) / arr.length : 0, decimals: 2 };
    }
    case "conversion_rate":
      return { value: ad.conversionRate, suffix: "%", decimals: 2 };
    case "revenue_net":
      return { value: s.totalNet, prefix: "R$ ", decimals: 2 };
    case "revenue_gross":
      return { value: s.totalGross, prefix: "R$ ", decimals: 2 };
    case "sales_count":
      return { value: sales.length, decimals: 0 };
    case "roas":
      return { value: ad.totalSpend > 0 ? s.totalNet / ad.totalSpend : 0, suffix: "x", decimals: 2 };
    case "roi": {
      const profit = s.totalNet - ad.totalSpend - s.totalTax;
      return { value: ad.totalSpend > 0 ? (profit / ad.totalSpend) * 100 : 0, suffix: "%", decimals: 2 };
    }
    case "profit":
      return { value: s.totalNet - ad.totalSpend - s.totalTax, prefix: "R$ ", decimals: 2 };
    default:
      return { value: 0, decimals: 2 };
  }
}

function metricFromInsight(metric: WidgetMetric, row: any): number {
  switch (metric) {
    case "spend":
      return row.spend ?? 0;
    case "leads":
      return row.leads ?? 0;
    case "cpl":
      return row.cpl ?? 0;
    case "ctr":
      return row.ctr ?? 0;
    case "cpm":
      return row.cpm ?? 0;
    case "clicks":
      return row.clicks ?? 0;
    case "impressions":
      return row.impressions ?? 0;
    case "frequency":
      return row.frequency ?? 0;
    case "conversion_rate":
      return row.conversion_rate ?? 0;
    default:
      return 0;
  }
}

export function useGroupedSeries(config: WidgetConfig) {
  const { insights, sales } = useDashboard();
  return useMemo(() => {
    const metric = (config.metric ?? "spend") as WidgetMetric;
    const groupBy = (config.groupBy ?? "date") as WidgetGroupBy;

    if (groupBy === "state") {
      const map = new Map<string, number>();
      sales.forEach((s) => {
        if (!s.lead_state) return;
        map.set(s.lead_state, (map.get(s.lead_state) ?? 0) + 1);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }
    if (groupBy === "formation") {
      const map = new Map<string, number>();
      sales.forEach((s) => {
        if (!s.lead_formation) return;
        map.set(s.lead_formation, (map.get(s.lead_formation) ?? 0) + 1);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }
    if (groupBy === "payment") {
      const map = new Map<string, number>();
      sales.forEach((s) => {
        const k = s.payment_method || "outros";
        map.set(k, (map.get(k) ?? 0) + (s.net_revenue || 0));
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }

    // groupBy: date / campaign / ad — aggregate from insights
    const keyFn =
      groupBy === "date"
        ? (r: any) => r.date
        : groupBy === "campaign"
          ? (r: any) => r.campaign_name || r.campaign_id || "—"
          : (r: any) => r.ad_name || r.ad_id || "—";

    const buckets = new Map<string, { name: string; sum: number; count: number }>();
    insights.forEach((r) => {
      const k = keyFn(r);
      const entry = buckets.get(k) ?? { name: k, sum: 0, count: 0 };
      entry.sum += metricFromInsight(metric, r);
      entry.count += 1;
      buckets.set(k, entry);
    });

    const isAvg = ["cpl", "ctr", "cpm", "frequency", "conversion_rate"].includes(metric);
    const arr = Array.from(buckets.values()).map((b) => ({
      name: b.name,
      value: isAvg ? b.sum / Math.max(1, b.count) : b.sum,
    }));
    if (groupBy === "date") arr.sort((a, b) => a.name.localeCompare(b.name));
    else arr.sort((a, b) => b.value - a.value);
    return arr;
  }, [insights, sales, config.metric, config.groupBy]);
}

export function formatMetricValue(metric: WidgetMetric, v: number): string {
  if (["spend", "cpl", "cpm", "revenue_net", "revenue_gross", "profit"].includes(metric)) {
    return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (["ctr", "conversion_rate", "roi"].includes(metric)) return `${Number(v).toFixed(2)}%`;
  if (metric === "roas") return `${Number(v).toFixed(2)}x`;
  if (metric === "frequency") return Number(v).toFixed(2);
  return Number(v).toLocaleString("pt-BR");
}

export function formatDateLabel(s: string) {
  try {
    return format(parseISO(s), "dd/MM");
  } catch {
    return s;
  }
}
