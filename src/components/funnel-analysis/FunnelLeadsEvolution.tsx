import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FunnelLeadsEvolution({ a }: { a: FunnelAnalytics }) {
  const data = a.evolution.map((d) => ({
    date: d.date,
    label: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
    Leads: d.leads,
    Oportunidades: d.opportunities,
    Vendas: d.conversions,
  }));

  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">4. Evolução de leads, oportunidades e vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data} className="funnel-evolution-chart">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
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
