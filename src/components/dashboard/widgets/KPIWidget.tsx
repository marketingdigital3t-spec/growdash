import { MetricCard } from "@/components/dashboard/MetricCard";
import { useDashboard } from "@/contexts/DashboardContext";
import { computeKpi } from "@/hooks/useWidgetData";
import { METRIC_LABELS, type WidgetConfig, type WidgetMetric } from "@/lib/widgetCatalog";
import { Activity } from "lucide-react";

export function KPIWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const { insights, sales, leadBreakdown } = useDashboard();
  const metric = (config.metric ?? "leads") as WidgetMetric;
  const k = computeKpi(metric, insights, sales);
  const includesConversationLeads = metric === "leads" || metric === "campaign_leads" || metric === "campaign_cpl" || metric === "campaign_conversion_rate";
  if (leadBreakdown && includesConversationLeads) {
    if (metric === "leads" || metric === "campaign_leads") k.value = leadBreakdown.total;
    if (metric === "campaign_cpl") k.value = k.value * (computeKpi("leads", insights, sales).value / Math.max(1, leadBreakdown.total));
    if (metric === "campaign_conversion_rate") {
      const clicks = insights.reduce((sum, row) => sum + Number(row.clicks ?? 0), 0);
      k.value = clicks > 0 ? (leadBreakdown.total / clicks) * 100 : 0;
    }
  }
  const leadTooltip = includesConversationLeads && leadBreakdown
    ? `Forms: ${leadBreakdown.forms} · Site: ${leadBreakdown.site} · Conversas iniciadas: ${leadBreakdown.conversations} · Total: ${leadBreakdown.total}`
    : undefined;
  return (
    <div className="h-full min-w-0">
      <MetricCard
        title={title || METRIC_LABELS[metric]}
        value={k.value}
        prefix={k.prefix}
        suffix={k.suffix}
        decimals={k.decimals}
        icon={<Activity className="h-4 w-4" />}
        tooltip={leadTooltip}
      />
    </div>
  );
}

export function KPIGridWidget({ config }: { config: WidgetConfig }) {
  const { insights, sales, leadBreakdown } = useDashboard();
  const metrics = (config.metrics ?? ["spend", "leads", "cpl", "ctr"]) as WidgetMetric[];
  return (
    <div className="gd-auto-grid-compact h-full gap-2">
      {metrics.map((m) => {
        const k = computeKpi(m, insights, sales);
        if (m === "leads" && leadBreakdown) k.value = leadBreakdown.total;
        const leadTooltip = m === "leads" && leadBreakdown
          ? `Forms: ${leadBreakdown.forms} · Site: ${leadBreakdown.site} · Conversas iniciadas: ${leadBreakdown.conversations} · Total: ${leadBreakdown.total}`
          : undefined;
        return (
          <MetricCard
            key={m}
            title={METRIC_LABELS[m]}
            value={k.value}
            prefix={k.prefix}
            suffix={k.suffix}
            decimals={k.decimals}
            icon={<Activity className="h-4 w-4" />}
            tooltip={leadTooltip}
          />
        );
      })}
    </div>
  );
}
