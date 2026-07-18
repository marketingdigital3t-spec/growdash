import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrazilMap } from "@/components/dashboard/BrazilMap";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function FunnelStateMap({ a }: { a: FunnelAnalytics }) {
  const leadMap: Record<string, number> = {};
  for (const s of a.stateBreakdown) {
    if (s.state && s.state.length === 2 && s.state !== "—") leadMap[s.state] = s.leads;
  }
  const topStates = a.stateBreakdown.filter((s) => s.state !== "—").slice(0, 10);

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">7. Mapa por estado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <BrazilMap data={leadMap} metricLabel="Leads" colorScheme="brand" />
          </div>
          <div className="space-y-3">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="text-muted-foreground sticky top-0 bg-card">
                  <tr className="border-b border-border/40">
                    <th className="text-left py-2 font-medium">UF</th>
                    <th className="text-right py-2 font-medium">Leads</th>
                    <th className="text-right py-2 font-medium">Conv.</th>
                    <th className="text-right py-2 font-medium">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {topStates.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sem dados de estado.</td></tr>
                  )}
                  {topStates.map((s) => (
                    <tr key={s.state} className="border-b border-border/20">
                      <td className="py-2 font-medium">{s.state}</td>
                      <td className="py-2 text-right tabular-nums">{s.leads}</td>
                      <td className="py-2 text-right tabular-nums text-emerald-400">{s.conversions}</td>
                      <td className="py-2 text-right tabular-nums">{s.conversionRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="h-40">
              <ResponsiveContainer>
                <BarChart data={topStates.slice(0, 8).map((s) => ({ uf: s.state, conv: s.conversions }))}>
                  <XAxis dataKey="uf" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} cursor={{ fill: "hsl(var(--muted) / 0.25)", stroke: "hsl(var(--border))" }}
                  />
                  <Bar dataKey="conv" radius={[4, 4, 0, 0]}>
                    {topStates.slice(0, 8).map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
