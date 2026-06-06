import { createContext, useContext, ReactNode } from "react";
import type { InsightRow } from "@/hooks/useInsights";
import type { Sale } from "@/hooks/useSales";
import type { RDDealLite } from "@/hooks/useRDDealsForPeriod";

export interface DashboardContextValue {
  startDate: Date;
  endDate: Date;
  adAccountId?: string; // undefined = all accounts
  insights: InsightRow[];
  sales: Sale[];
  rdDeals: RDDealLite[];
  alerts: any[];
  campaigns: any[];
  adAccounts: any[];
  products: any[];
  isLoading: boolean;
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
