import { createContext, useContext, ReactNode } from "react";
import type { InsightRow } from "@/hooks/useInsights";
import type { Sale } from "@/hooks/useSales";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";
import type { WidgetMetric } from "@/lib/widgetCatalog";

export interface DashboardContextValue {
  startDate: Date;
  endDate: Date;
  adAccountId?: string; // undefined = all accounts
  insights: InsightRow[];
  sales: Sale[];
  rdDeals: RDDealLite[];
  revenueDeals?: RDDealLite[];
  alerts: any[];
  campaigns: any[];
  adAccounts: any[];
  products: any[];
  isLoading: boolean;
  leadBreakdown?: {
    forms: number;
    site: number;
    conversations: number;
    total: number;
  };
  /**
   * Read-only dashboards can provide a metric whose business definition is
   * different from the acquisition dashboard (for example, sold / RD leads).
   */
  metricOverrides?: Partial<Record<WidgetMetric, number>>;
}

const Ctx = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ value, children }: { value: DashboardContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard must be used inside DashboardProvider");
  return v;
}
