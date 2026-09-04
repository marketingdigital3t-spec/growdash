import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FunnelAnalytics } from "@/hooks/useRDDeals";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function FunnelSourceTable({ a }: { a: FunnelAnalytics }) {
  const rows = a.sourceBreakdown.slice(0, 10);
  const totalLeads = a.sourceBreakdown.reduce((sum, row) => sum + row.leads, 0);
  const filledLeads = a.sourceBreakdown.filter((row) => row.source !== "Não informado").reduce((sum, row) => sum + row.leads, 0);
  const quality = totalLeads ? (filledLeads / totalLeads) * 100 : 0;
  return (
    <Card className="gd-analysis-card bg-card/60 border-border/40">
      <CardHeader>
        <CardTitle className="text-base">5. Origem dos leads que mais vendem</CardTitle>
        <p className="mt-1 text-xs font-normal text-muted-foreground">Qualidade de origem: <b className={quality >= 80 ? "text-emerald-500" : quality >= 50 ? "text-amber-500" : "text-red-500"}>{quality.toFixed(0)}% preenchida</b> · CPL/CAC por origem só aparece quando o custo Meta estiver ligado à mesma UTM, evitando rateio artificial.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="text-left py-2 font-medium">Origem</th>
                <th className="text-right py-2 font-medium">Leads</th>
                <th className="text-right py-2 font-medium">Vendas</th>
                <th className="text-right py-2 font-medium">Conv.</th>
                <th className="text-right py-2 font-medium">Receita RD</th>
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
