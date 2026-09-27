import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { parseISO, format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FunnelLeadsEvolution({ a }: { a: FunnelAnalytics }) {
  const data = a.evolution.map((d) => ({
    date: d.date,
    label: isValid(parseISO(d.date)) ? format(parseISO(d.date), "dd/MM", { locale: ptBR }) : "Sem data",
    Leads: d.leads,
    Oportunidades: d.opportunities,
    Vendas: d.conversions,
  }));
  const firstActive = data.findIndex((row) => row.Leads > 0 || row.Oportunidades > 0 || row.Vendas > 0);
  const lastActive = data.findLastIndex((row) => row.Leads > 0 || row.Oportunidades > 0 || row.Vendas > 0);
  // O cálculo inclui dias vazios para preservar o intervalo selecionado. No
  // gráfico, removemos apenas o vazio externo para que os eventos reais não
  // fiquem comprimidos no canto direito do bloco.
  const chartData = firstActive >= 0 ? data.slice(firstActive, lastActive + 1) : data;

  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">4. Evolução de leads, oportunidades e vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chartData} className="funnel-evolution-chart" margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={24} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line className="funnel-line-leads" type="monotone" dataKey="Leads" stroke="#2563eb" fill="none" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#2563eb" }} />
              <Line className="funnel-line-opportunities" type="monotone" dataKey="Oportunidades" stroke="#d97706" fill="none" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#d97706" }} />
              <Line className="funnel-line-sales" type="monotone" dataKey="Vendas" stroke="#16a34a" fill="none" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "#16a34a" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
