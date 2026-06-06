import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChartCardProps {
  title: string;
  data: any[];
  type: "line" | "bar";
  dataKey: string;
  color?: string;
  xKey?: string;
  formatLabel?: (v: any) => string;
}

export function ChartCard({ title, data, type, dataKey, color = "hsl(221, 83%, 53%)", xKey = "date", formatLabel }: ChartCardProps) {
  const formatX = (value: string) => {
    try {
      return format(parseISO(value), "dd/MM", { locale: ptBR });
    } catch {
      return value;
    }
  };

  const formatTooltipValue = (value: number) => {
    if (formatLabel) return formatLabel(value);
    return value.toFixed(2);
  };

  return (
    <Card className="transition-shadow duration-300 hover:shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Sem dados para o período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            {type === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey={xKey} tickFormatter={xKey === "date" ? formatX : undefined} className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipValue} labelFormatter={xKey === "date" ? formatX : undefined} />
                <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} animationDuration={800} animationEasing="ease-out" />
              </LineChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey={xKey} tickFormatter={xKey === "date" ? formatX : undefined} className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip formatter={formatTooltipValue} labelFormatter={xKey === "date" ? formatX : undefined} />
                <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} animationDuration={800} animationEasing="ease-out" />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
