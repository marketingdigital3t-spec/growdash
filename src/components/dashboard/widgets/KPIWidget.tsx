import { MetricCard } from "@/components/dashboard/MetricCard";
import { useDashboard } from "@/contexts/DashboardContext";
import { computeKpi } from "@/hooks/useWidgetData";
import { METRIC_LABELS, type WidgetConfig, type WidgetMetric } from "@/lib/widgetCatalog";
import { Activity } from "lucide-react";

export function KPIWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const { insights, sales } = useDashboard();
  const metric = (config.metric ?? "leads") as WidgetMetric;
  const k = computeKpi(metric, insights, sales);
  return (
    <div className="h-full min-w-0">
      <MetricCard
        title={title || METRIC_LABELS[metric]}
        value={k.value}
        prefix={k.prefix}
        suffix={k.suffix}
        decimals={k.decimals}
        icon={<Activity className="h-4 w-4" />}
      />
    </div>
  );
}

export function KPIGridWidget({ config }: { config: WidgetConfig }) {
  const { insights, sales } = useDashboard();
  const metrics = (config.metrics ?? ["spend", "leads", "cpl", "ctr"]) as WidgetMetric[];
  return (
    <div className="gd-auto-grid-compact h-full gap-2">
      {metrics.map((m) => {
        const k = computeKpi(m, insights, sales);
        return (
          <MetricCard
            key={m}
            title={METRIC_LABELS[m]}
            value={k.value}
            prefix={k.prefix}
            suffix={k.suffix}
            decimals={k.decimals}
            icon={<Activity className="h-4 w-4" />}
          />
        );
      })}
    </div>
  );
}
