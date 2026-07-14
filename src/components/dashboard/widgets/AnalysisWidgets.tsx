import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGroupedSeries, formatMetricValue, computeKpi } from "@/hooks/useWidgetData";
import { METRIC_LABELS, type WidgetConfig, type WidgetMetric } from "@/lib/widgetCatalog";
import { useDashboard } from "@/contexts/DashboardContext";
import { useMemo } from "react";
import { subDays, differenceInDays, isWithinInterval, parseISO } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";

export function TopRankingWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const data = useGroupedSeries(config);
  const metric = (config.metric ?? "leads") as WidgetMetric;
  const limit = config.limit ?? 5;
  const sorted = [...data].sort((a, b) => (config.direction === "worst" ? a.value - b.value : b.value - a.value)).slice(0, limit);
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">{METRIC_LABELS[metric]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={row.name}>
                <TableCell className="font-medium">{i + 1}</TableCell>
                <TableCell className="truncate max-w-[200px]">{row.name}</TableCell>
                <TableCell className="text-right">{formatMetricValue(metric, row.value)}</TableCell>
              </TableRow>
            ))}
            {!sorted.length && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  Sem dados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ComparePeriodWidget({ title, config }: { title: string; config: WidgetConfig }) {
  const { insights, sales, startDate, endDate } = useDashboard();
  const metric = (config.metric ?? "cpl") as WidgetMetric;
  const result = useMemo(() => {
    const days = Math.max(1, differenceInDays(endDate, startDate) + 1);
    const prevEnd = subDays(startDate, 1);
    const prevStart = subDays(prevEnd, days - 1);
    const inPrev = (d: string) => {
      try {
        return isWithinInterval(parseISO(d), { start: prevStart, end: prevEnd });
      } catch {
        return false;
      }
    };
    const prevInsights = insights.filter((r) => inPrev(r.date));
    const prevSales = sales.filter((s) => inPrev(s.sale_date));
    const cur = computeKpi(metric, insights, sales);
    const prev = computeKpi(metric, prevInsights, prevSales);
    const delta = prev.value === 0 ? (cur.value > 0 ? 100 : 0) : ((cur.value - prev.value) / Math.abs(prev.value)) * 100;
    return { cur, prev, delta };
  }, [insights, sales, startDate, endDate, metric]);

  const isInverse = ["cpl", "cpm"].includes(metric);
  const positive = isInverse ? result.delta < 0 : result.delta > 0;
  const color = result.delta === 0 ? "text-muted-foreground" : positive ? "text-emerald-600" : "text-red-600";

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title || `${METRIC_LABELS[metric]} vs período anterior`}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {result.cur.prefix}
          {Number(result.cur.value).toLocaleString("pt-BR", { minimumFractionDigits: result.cur.decimals, maximumFractionDigits: result.cur.decimals })}
          {result.cur.suffix}
        </div>
        <div className={`flex items-center gap-1 text-sm mt-1 ${color}`}>
          {result.delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {Math.abs(result.delta).toFixed(1)}%
          <span className="text-muted-foreground ml-2">
            antes: {result.prev.prefix}
            {Number(result.prev.value).toFixed(result.prev.decimals)}
            {result.prev.suffix}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
