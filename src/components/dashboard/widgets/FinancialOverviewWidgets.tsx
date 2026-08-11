import { useMemo, useState } from "react";
import { Chrome, Facebook, Globe, Globe2, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { PaymentChart } from "@/components/dashboard/PaymentChart";
import { PlatformDrilldownSheet } from "@/components/dashboard/PlatformDrilldownSheet";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePlatformRules } from "@/hooks/usePlatformRules";
import { inferPlatform, inferPlatformWithDealFallback, PLATFORM_LABELS, type TopPlatform } from "@/lib/platformInference";
import { aggregateSales } from "@/hooks/useSales";

const PLATFORM_COLORS: Record<TopPlatform, string> = {
  meta: "hsl(var(--primary))",
  google: "hsl(var(--primary) / .66)",
  organic: "hsl(var(--primary) / .42)",
  unknown: "hsl(var(--muted-foreground))",
};

type PlatformRow = {
  key: TopPlatform;
  name: string;
  leads: number;
  sales: number;
  revenue: number;
  conv: number;
};

/** A standalone widget so payment and attribution blocks can be edited independently. */
export function PaymentChartWidget() {
  const { sales } = useDashboard();
  return <PaymentChart byPayment={aggregateSales(sales).byPayment} />;
}

/**
 * Keeps platform attribution in the same visual language as the default dashboard,
 * but makes the whole block a first-class grid item with its own resize/move handle.
 */
export function PlatformDistributionWidget() {
  const { sales, rdDeals, leadBreakdown } = useDashboard();
  const { data: platformRules = [] } = usePlatformRules();
  const [drilldown, setDrilldown] = useState<TopPlatform | null>(null);
  const [platformView, setPlatformView] = useState<"leads" | "revenue" | "conv">("leads");

  const platformBreakdown = useMemo<PlatformRow[]>(() => {
    const rows: Record<TopPlatform, Omit<PlatformRow, "key" | "name" | "conv">> = {
      meta: { leads: leadBreakdown?.total ?? 0, sales: 0, revenue: 0 },
      google: { leads: 0, sales: 0, revenue: 0 },
      organic: { leads: 0, sales: 0, revenue: 0 },
      unknown: { leads: 0, sales: 0, revenue: 0 },
    };
    const dealsByRdId = new Map(rdDeals.map((deal) => [deal.rd_deal_id, deal]));
    rdDeals.forEach((deal) => {
      const platform = inferPlatform(deal, platformRules).platform;
      if (platform === "meta" || platform === "unknown") return;
      rows[platform].leads += 1;
    });
    sales.forEach((sale) => {
      if (sale.status !== "confirmed") return;
      const platform = inferPlatformWithDealFallback(sale, dealsByRdId, platformRules).platform;
      rows[platform].sales += 1;
      rows[platform].revenue += sale.net_revenue;
    });
    return (Object.keys(rows) as TopPlatform[])
      .map((key) => ({
        key,
        name: PLATFORM_LABELS[key],
        ...rows[key],
        conv: rows[key].leads > 0 ? (rows[key].sales / rows[key].leads) * 100 : 0,
      }))
      .filter((row) => row.key !== "unknown" || row.sales > 0 || row.revenue > 0)
      .sort((a, b) => (b.revenue - a.revenue) || (b.leads - a.leads));
  }, [leadBreakdown?.total, platformRules, rdDeals, sales]);

  const totalSales = platformBreakdown.reduce((sum, row) => sum + row.sales, 0);
  const totalRevenue = platformBreakdown.reduce((sum, row) => sum + row.revenue, 0);
  const totalLeads = platformBreakdown.reduce((sum, row) => sum + row.leads, 0);
  const averageConversion = totalLeads > 0 ? (totalSales / totalLeads) * 100 : 0;
  const isConversion = platformView === "conv";
  const valueOf = (row: PlatformRow) => platformView === "leads" ? row.leads : platformView === "revenue" ? row.revenue : row.conv;
  const total = platformBreakdown.reduce((sum, row) => sum + valueOf(row), 0);
  const formatValue = (value: number) => platformView === "revenue"
    ? `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : platformView === "conv" ? `${value.toFixed(2)}%` : value.toLocaleString("pt-BR");
  const chartData = platformBreakdown.map((row) => ({ name: row.name, key: row.key, value: valueOf(row) })).filter((row) => row.value > 0);
  const maxConversion = Math.max(...platformBreakdown.map((row) => row.conv), 0.0001);
  const icons: Record<TopPlatform, typeof Facebook> = { meta: Facebook, google: Chrome, organic: Globe, unknown: HelpCircle };
  const headerLabel = platformView === "leads"
    ? `${totalLeads} leads`
    : platformView === "revenue"
      ? formatCurrency(totalRevenue)
      : `Conv. média ${averageConversion.toFixed(2)}%`;

  return <>
    <Card className="dashboard-glass-card h-full min-w-0 overflow-hidden">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="h-4 w-4" />Distribuição por Plataforma</CardTitle>
          <span className="text-xs tabular-nums text-muted-foreground">{headerLabel}</span>
        </div>
        <Tabs value={platformView} onValueChange={(value) => setPlatformView(value as typeof platformView)}>
          <TabsList className="mx-auto grid h-9 w-full max-w-md grid-cols-3 place-items-stretch p-1">
            <TabsTrigger value="leads" className="w-full justify-center text-xs">Leads</TabsTrigger>
            <TabsTrigger value="revenue" className="w-full justify-center text-xs">Receita</TabsTrigger>
            <TabsTrigger value="conv" className="w-full justify-center text-xs">Conversão</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 md:flex-row">
          {!isConversion && <div className="relative h-[170px] w-[170px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                  {chartData.map((row) => <Cell key={row.key} fill={PLATFORM_COLORS[row.key as TopPlatform]} />)}
                </Pie>
                <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(value: number) => formatValue(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="px-2 text-center text-sm font-semibold tabular-nums">{formatValue(total)}</div>
            </div>
          </div>}
          <div className={`w-full flex-1 space-y-1.5 ${isConversion ? "" : "min-w-0"}`}>
            {platformBreakdown.filter((row) => !(isConversion && row.key === "unknown")).map((row) => {
              const value = valueOf(row);
              const percentage = !isConversion && total > 0 ? (value / total) * 100 : 0;
              const barPercentage = isConversion ? (row.conv / maxConversion) * 100 : percentage;
              const unknown = row.key === "unknown";
              const Icon = icons[row.key];
              const Tag = unknown ? "div" : "button";
              return <Tag key={row.key} {...(unknown ? {} : { type: "button", onClick: () => setDrilldown(row.key) })} className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${unknown ? "" : "hover:bg-muted/40"}`}>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${PLATFORM_COLORS[row.key]}20`, color: PLATFORM_COLORS[row.key] }}><Icon className="h-3 w-3" /></div>
                  <div className="min-w-0 flex-1 truncate text-xs font-medium">{row.name}</div>
                  <div className="shrink-0 text-xs font-semibold tabular-nums">{formatValue(value)}</div>
                  {!isConversion && <div className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{percentage.toFixed(1)}%</div>}
                </div>
                {isConversion && <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full rounded transition-all" style={{ width: `${barPercentage}%`, backgroundColor: PLATFORM_COLORS[row.key] }} /></div>}
              </Tag>;
            })}
            {(() => {
              const unknown = platformBreakdown.find((row) => row.key === "unknown");
              if (!unknown || (unknown.sales === 0 && unknown.revenue === 0)) return null;
              return <div className="mt-2 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">{unknown.sales} venda{unknown.sales === 1 ? "" : "s"} sem plataforma identificada ({formatCurrency(unknown.revenue)}).</div>;
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
    <PlatformDrilldownSheet platform={drilldown} onClose={() => setDrilldown(null)} />
  </>;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
