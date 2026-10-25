import type { WidgetMetric } from "./widgetCatalog";
import type { MetricAvailability } from "./metricAvailability";

type MetaSnapshotStatus = "fresh" | "syncing" | "stale" | "partial" | "error";

export interface DashboardMetricAvailabilityInput {
  isLoading: boolean;
  hasSnapshot: boolean;
  rowCount: number;
  status: MetaSnapshotStatus;
  leadAvailable: boolean;
  reason?: string | null;
  revenueAvailability: MetricAvailability;
}

export function buildDashboardMetricAvailability({
  isLoading,
  hasSnapshot,
  rowCount,
  status,
  leadAvailable,
  reason,
  revenueAvailability,
}: DashboardMetricAvailabilityInput): Partial<Record<WidgetMetric, MetricAvailability>> {
  const state = (available: boolean, unavailableReason?: string | null): MetricAvailability => {
    if (isLoading) return { state: "loading" };
    if (available) {
      if (status === "error") {
        return { state: "partial", reason: unavailableReason || reason || "A atualização Meta falhou; o último snapshot permanece visível." };
      }
      if (status === "syncing" || status === "stale" || status === "partial") {
        return { state: "stale", reason: "Atualizando Meta em segundo plano; o último snapshot permanece visível." };
      }
      return rowCount === 0 ? { state: "empty_confirmed" } : { state: "fresh" };
    }
    return { state: "unavailable", reason: unavailableReason || reason || "Dados Meta indisponíveis para este recorte." };
  };

  const metaReason = reason || "Dados Meta indisponíveis para este recorte.";
  const hasDeliverySnapshot = state(hasSnapshot, metaReason);
  const hasLeadSnapshot = state(leadAvailable, reason);

  return {
    spend: hasDeliverySnapshot,
    clicks: hasDeliverySnapshot,
    impressions: hasDeliverySnapshot,
    ctr: hasDeliverySnapshot,
    cpm: hasDeliverySnapshot,
    frequency: hasDeliverySnapshot,
    leads: hasLeadSnapshot,
    cpl: hasLeadSnapshot,
    conversion_rate: hasLeadSnapshot,
    campaign_leads: hasLeadSnapshot,
    campaign_cpl: hasLeadSnapshot,
    campaign_ctr: hasDeliverySnapshot,
    campaign_conversion_rate: hasLeadSnapshot,
    revenue_gross: revenueAvailability,
    revenue_net: revenueAvailability,
    sales_count: revenueAvailability,
    roas: revenueAvailability,
    roi: revenueAvailability,
    profit: revenueAvailability,
    profit_margin: revenueAvailability,
    receivables: revenueAvailability,
    average_ticket: revenueAvailability,
  };
}
