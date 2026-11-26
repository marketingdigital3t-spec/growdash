import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useGroupedSeries, formatMetricValue, formatDateLabel } from "@/hooks/useWidgetData";
import { METRIC_LABELS, type WidgetConfig, type WidgetMetric } from "@/lib/widgetCatalog";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(180, 70%, 45%)",
  "hsl(330, 80%, 55%)",
  "hsl(50, 90%, 55%)",
];

function ChartShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 pb-4">
        <div className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            {children as any}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function LineChartWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const data = useGroupedSeries(config);
  const metric = (config.metric ?? "spend") as WidgetMetric;
  if (!data.length)
    return (
      <Card className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Sem dados para o período
      </Card>
    );
  return (
    <ChartShell title={title}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickFormatter={config.groupBy === "date" ? formatDateLabel : undefined}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: number) => [formatMetricValue(metric, v), METRIC_LABELS[metric]]}
          labelFormatter={config.groupBy === "date" ? formatDateLabel : undefined}
        />
        <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={false} />
      </LineChart>
    </ChartShell>
  );
}

export function BarChartWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const data = useGroupedSeries(config);
  const metric = (config.metric ?? "spend") as WidgetMetric;
  if (!data.length)
    return (
      <Card className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Sem dados para o período
      </Card>
    );
  const horizontal = config.orientation === "horizontal";
  return (
    <ChartShell title={title}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
          </>
        ) : (
          <>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              tickFormatter={config.groupBy === "date" ? formatDateLabel : undefined}
            />
            <YAxis tick={{ fontSize: 11 }} />
          </>
        )}
        <Tooltip
          formatter={(v: number) => [formatMetricValue(metric, v), METRIC_LABELS[metric]]}
          labelFormatter={config.groupBy === "date" ? formatDateLabel : undefined}
        />
        <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartShell>
  );
}

export function PieChartWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const data = useGroupedSeries(config).slice(0, 8);
  const metric = (config.metric ?? "leads") as WidgetMetric;
  if (!data.length)
    return (
      <Card className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Sem dados para o período
      </Card>
    );
  return (
    <ChartShell title={title}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={config.variant === "donut" ? "55%" : 0}
          outerRadius="85%"
          label={({ name, percent }) => `${String(name).slice(0, 14)} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => [formatMetricValue(metric, v), METRIC_LABELS[metric]]} />
      </PieChart>
    </ChartShell>
  );
}
