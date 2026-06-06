import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

interface DailyDataPoint {
  date: string;
  spend: number;
  leads: number;
  cpl: number;
  [key: string]: any;
}

interface PerformanceLineChartProps {
  data: DailyDataPoint[];
}

const METRICS = [
  { key: "cpl", label: "CPL", color: "hsl(221, 83%, 53%)", yAxisId: "left", prefix: "R$ " },
  { key: "spend", label: "Investimento", color: "hsl(262, 83%, 58%)", yAxisId: "left", prefix: "R$ " },
  { key: "leads", label: "Leads", color: "hsl(142, 71%, 45%)", yAxisId: "right", prefix: "" },
] as const;

export function PerformanceLineChart({ data }: PerformanceLineChartProps) {
  const [active, setActive] = useState<Set<string>>(new Set(["cpl", "spend", "leads"]));

  const toggle = (key: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const hasLeft = METRICS.some((m) => m.yAxisId === "left" && active.has(m.key));
  const hasRight = METRICS.some((m) => m.yAxisId === "right" && active.has(m.key));

  return (
    <Card className="relative">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Evolução de Performance
          </CardTitle>
          <div className="flex gap-1.5 flex-wrap">
            {METRICS.map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={active.has(m.key) ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                style={active.has(m.key) ? { backgroundColor: m.color, borderColor: m.color } : {}}
                onClick={() => toggle(m.key)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {(!data || data.length === 0) && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none text-center text-xs text-muted-foreground">
            Sem dados para o período. Os valores aparecerão após a sincronização.
          </div>
        )}

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickFormatter={(v) => {
                  const parts = v.split("-");
                  return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : v;
                }}
              />
              {hasLeft && (
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => `R$ ${Number(v).toFixed(0)}`}
                  width={65}
                />
              )}
              {hasRight && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  width={45}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  const m = METRICS.find((m) => m.key === name);
                  const formatted = m?.prefix
                    ? `${m.prefix}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : value.toLocaleString("pt-BR");
                  return [formatted, m?.label || name];
                }}
                labelFormatter={(label) => {
                  const parts = String(label).split("-");
                  return parts.length >= 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : label;
                }}
              />
              {METRICS.map(
                (m) =>
                  active.has(m.key) && (
                    <Line
                      key={m.key}
                      yAxisId={hasLeft && hasRight ? m.yAxisId : hasLeft ? "left" : "right"}
                      type="monotone"
                      dataKey={m.key}
                      stroke={m.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      animationDuration={600}
                    />
                  )
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
