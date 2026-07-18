import { lazy, Suspense } from "react";
import type { WidgetType, WidgetConfig } from "@/lib/widgetCatalog";
import { KPIWidget, KPIGridWidget } from "@/components/dashboard/widgets/KPIWidget";
import { LineChartWidget, BarChartWidget, PieChartWidget } from "@/components/dashboard/widgets/ChartWidgets";
import { TopRankingWidget, ComparePeriodWidget } from "@/components/dashboard/widgets/AnalysisWidgets";
import { DefaultDashboardContent, CampaignsDetailWidget } from "@/components/dashboard/widgets/DefaultDashboardContent";
import { AskAICard } from "@/components/dashboard/AskAICard";
import { BudgetAnalysis } from "@/components/dashboard/BudgetAnalysis";
import { AlertsSection } from "@/components/dashboard/AlertsSection";
import { BrazilMap } from "@/components/dashboard/BrazilMap";
import { RDSalesList } from "@/components/dashboard/widgets/RDSalesList";
import { AttributionWidget } from "@/components/dashboard/widgets/AttributionWidget";
import { RDCustomFieldPieWidget } from "@/components/dashboard/widgets/RDCustomFieldPieWidget";

import { BestPeriodOfDayWidget } from "@/components/dashboard/widgets/BestPeriodOfDayWidget";
import { BestWeekdayWidget } from "@/components/dashboard/widgets/BestWeekdayWidget";
import { GeoOriginWidget } from "@/components/dashboard/widgets/GeoOriginWidget";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAlerts, useMarkAlertRead } from "@/hooks/useAlerts";
import type { Sale } from "@/hooks/useSales";

interface Props {
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  onEditSale?: (s: Sale) => void;
}

function BrazilMapWrap() {
  const { sales } = useDashboard();
  const map: Record<string, number> = {};
  sales.forEach((s) => { if (s.lead_state) map[s.lead_state] = (map[s.lead_state] || 0) + 1; });
  return <BrazilMap data={map} />;
}

function AlertsWrap() {
  const { data: alerts = [] } = useAlerts(true);
  const mark = useMarkAlertRead();
  return <div className="h-full overflow-auto"><AlertsSection alerts={alerts} onMarkRead={(id) => mark.mutate(id)} /></div>;
}

export function WidgetRenderer({ type, title, config, onEditSale }: Props) {
  switch (type) {
    case "kpi":
      return <KPIWidget title={title} config={config} />;
    case "kpi_grid":
      return <KPIGridWidget config={config} />;
    case "line_chart":
      return <LineChartWidget title={title} config={config} />;
    case "bar_chart":
      return <BarChartWidget title={title} config={config} />;
    case "pie_chart":
      return <PieChartWidget title={title} config={config} />;
    case "top_ranking":
      return <TopRankingWidget title={title} config={config} />;
    case "compare_period":
      return <ComparePeriodWidget title={title} config={config} />;
    case "brazil_map":
      return <BrazilMapWrap />;
    case "alerts":
      return <AlertsWrap />;
    case "rd_sales_list":
      return <RDSalesList />;
    case "attribution":
      return <AttributionWidget />;

    case "best_period_of_day":
      return <BestPeriodOfDayWidget />;
    case "best_weekday":
      return <BestWeekdayWidget />;
    case "geo_origin":
      return <GeoOriginWidget />;
    case "rd_custom_field_pie":
      return <RDCustomFieldPieWidget />;
    case "ask_ai":
      return <div className="h-full overflow-auto"><AskAICard /></div>;
    case "budget_bm":
      return <div className="h-full overflow-auto"><BudgetAnalysis /></div>;
    case "campaigns_detail":
      return <CampaignsDetailWidget />;
    case "default_block":
      return <DefaultDashboardContent onEditSale={onEditSale ?? (() => {})} hidePrimary={config.hidePrimary} />;
    default:
      return <div className="p-4 text-sm text-muted-foreground">Widget desconhecido: {type}</div>;
  }
}
