import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FunnelSourceTable({ a }: { a: FunnelAnalytics }) {
  const rows = a.sourceBreakdown.slice(0, 10);
  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">5. Origem dos leads que mais vendem</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="text-left py-2 font-medium">Origem</th>
                <th className="text-right py-2 font-medium">Leads</th>
                <th className="text-right py-2 font-medium">Vendas</th>
                <th className="text-right py-2 font-medium">Conv.</th>
                <th className="text-right py-2 font-medium">Receita</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Sem dados de origem.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.source} className="border-b border-border/20">
                  <td className="py-2 truncate max-w-[140px]" title={r.source}>{r.source}</td>
                  <td className="py-2 text-right tabular-nums">{r.leads}</td>
                  <td className="py-2 text-right tabular-nums text-emerald-400">{r.sales}</td>
                  <td className="py-2 text-right tabular-nums">{r.conversionRate.toFixed(1)}%</td>
                  <td className="py-2 text-right tabular-nums">{fmtBRL(r.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
