import { useEffect, useMemo, useState } from "react";
import { BarChart3, LockKeyhole, ShieldCheck } from "lucide-react";
import { MotionItem, MotionPage } from "@/components/motion/MotionContainer";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { KPIWidget } from "@/components/dashboard/widgets/KPIWidget";
import { PaymentChartWidget, PlatformDistributionWidget } from "@/components/dashboard/widgets/FinancialOverviewWidgets";
import { Card, CardContent } from "@/components/ui/card";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useDateFilter } from "@/hooks/useDateFilter";
import { useInsights } from "@/hooks/useInsights";
import { useSales } from "@/hooks/useSales";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";

/**
 * Deliberately separate from the editable operational dashboard. The page only
 * queries metric sources protected by account RLS and renders no write actions,
 * integrations, CRM details, campaign editor, or dashboard configuration.
 */
export default function ExpertDashboard() {
  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();
  const { data: accounts = [], isLoading: loadingAccounts } = useAdAccounts();
  const [accountId, setAccountId] = useState("all");

  useEffect(() => {
    if (loadingAccounts || accounts.length === 0) return;
    if (accounts.length === 1) setAccountId(accounts[0].id);
    else if (accountId !== "all" && !accounts.some((account) => account.id === accountId)) setAccountId("all");
  }, [accountId, accounts, loadingAccounts]);

  const selectedId = accountId === "all" ? undefined : accountId;
  const { data: insights = [], isLoading: loadingInsights } = useInsights({ adAccountId: selectedId, startDate, endDate });
  const { data: sales = [] } = useSales({ adAccountId: selectedId, startDate, endDate });
  const { data: rdDeals = [] } = useRDDealsForPeriod({ adAccountId: selectedId, startDate, endDate });
  const permittedAccounts = useMemo(() => accounts.map((account) => ({ id: account.id, name: account.name })), [accounts]);
  const isLoading = loadingAccounts || loadingInsights;

  return (
    <MotionPage className="expert-dashboard min-w-0 space-y-4 sm:space-y-6">
      <MotionItem>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[.16em]">Growdash</span></div>
            <h1 className="mt-1 text-2xl font-bold">Painel do Expert</h1>
            <p className="mt-1 text-sm text-muted-foreground">Resultados autorizados para acompanhamento da operação.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[.07] px-3 py-1.5 text-xs font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5" />Somente leitura</div>
        </div>
      </MotionItem>

      <MotionItem>
        <DateFilterBar
          preset={preset}
          onPresetChange={setPreset}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          startDate={startDate}
          endDate={endDate}
          adAccounts={permittedAccounts}
          selectedAccount={accountId}
          onAccountChange={setAccountId}
          showSummary
        />
      </MotionItem>

      <DashboardProvider value={{ startDate, endDate, adAccountId: selectedId, insights, sales, rdDeals, alerts: [], campaigns: [], adAccounts: accounts, products: [], isLoading }}>
        <MotionItem>
          <section aria-label="Indicadores de performance" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KPIWidget title="Faturamento líquido" config={{ metric: "revenue_net" }} />
            <KPIWidget title="Investimento" config={{ metric: "spend" }} />
            <KPIWidget title="Leads" config={{ metric: "leads" }} />
            <KPIWidget title="CPL" config={{ metric: "cpl" }} />
            <KPIWidget title="ROAS" config={{ metric: "roas" }} />
            <KPIWidget title="Lucro" config={{ metric: "profit" }} />
            <KPIWidget title="Margem" config={{ metric: "profit_margin" }} />
            <KPIWidget title="Recebíveis" config={{ metric: "receivables" }} />
            <KPIWidget title="CTR" config={{ metric: "ctr" }} />
            <KPIWidget title="Taxa de conversão" config={{ metric: "conversion_rate" }} />
          </section>
        </MotionItem>

        <MotionItem>
          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <PaymentChartWidget />
            <PlatformDistributionWidget />
          </section>
        </MotionItem>
      </DashboardProvider>

      {!isLoading && accounts.length === 0 && (
        <Card className="border-dashed"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><LockKeyhole className="h-5 w-5 text-primary" />Nenhuma conta foi autorizada para este acesso. Solicite ao administrador que vincule uma conta de anúncio.</CardContent></Card>
      )}
    </MotionPage>
  );
}
