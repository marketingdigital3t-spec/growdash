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
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">3. Evolução de leads, oportunidades e vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Leads" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Oportunidades" stroke="hsl(45 93% 55%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Vendas" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
