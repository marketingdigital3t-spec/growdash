import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TriangleAlert } from "lucide-react";
import type { Sale } from "@/hooks/useSales";
import { getExpertAttribution } from "@/lib/expertDashboardMetrics";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Shows the closed-loop sale attribution for exactly the account and period
 * selected in Funnel Analysis. UTMs are intentionally shown, not inferred. */
export function FunnelSalesAttribution({ sales }: { sales: Sale[] }) {
  const rows = getExpertAttribution(sales);
  const attributed = rows.filter((row) => row.campaign !== "Não atribuída" && row.creative !== "Criativo não identificado");
  const attributedSales = attributed.reduce((total, row) => total + row.sales, 0);
  const totalSales = rows.reduce((total, row) => total + row.sales, 0);
  const trackingScore = totalSales > 0 ? (attributedSales / totalSales) * 100 : 0;

  return (
    <Card className="gd-analysis-card min-w-0 bg-card/60 border-border/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />10. Vendas por campanha e criativo</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Fechamento do ciclo usando campanha (UTM campaign) e criativo (UTM content) gravados no RD.</p>
        </div>
        <Badge variant="outline" className="shrink-0 tabular-nums">Rastreamento {trackingScore.toFixed(0)}% · {attributedSales.toLocaleString("pt-BR")}/{totalSales.toLocaleString("pt-BR")}</Badge>
      </CardHeader>
      <CardContent className="min-w-0">
        {rows.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">Nenhuma venda confirmada no período selecionado.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead className="bg-muted/35 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Campanha</th>
                  <th className="px-4 py-3 font-semibold">Criativo</th>
                  <th className="px-4 py-3 text-right font-semibold">Vendas</th>
                  <th className="px-4 py-3 text-right font-semibold">Receita líquida</th>
                  <th className="px-4 py-3 text-right font-semibold">Ticket</th>
                  <th className="px-4 py-3 font-semibold">Decisão</th>
                  <th className="px-4 py-3 font-semibold">Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/45">
                {rows.map((row) => {
                  const untracked = row.campaign === "Não atribuída" || row.creative === "Criativo não identificado";
                  // Sem campanha e criativo identificados não existe base
                  // confiável para realocar orçamento, mesmo com muitas vendas.
                  const decision = untracked ? "Corrigir rastreamento" : row.sales >= 2 ? "Candidato a escala" : "Validar com mais dados";
                  return <tr key={`${row.campaign}-${row.creative}`} className="transition-colors hover:bg-muted/25">
                    <td className="max-w-[250px] truncate px-4 py-3 font-medium" title={row.campaign}>{row.campaign}</td>
                    <td className="max-w-[250px] truncate px-4 py-3 text-muted-foreground" title={row.creative}>{row.creative}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.sales.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(row.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(row.sales > 0 ? row.revenue / row.sales : 0)}</td>
                    <td className="px-4 py-3"><span className={untracked ? "inline-flex items-center gap-1 text-amber-500" : row.sales >= 2 ? "inline-flex items-center gap-1 text-emerald-400" : "inline-flex items-center gap-1 text-muted-foreground"}>{untracked && <TriangleAlert className="h-3.5 w-3.5" title="UTM incompleta" />}{!untracked && <TrendingUp className="h-3.5 w-3.5" />}{decision}</span></td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{row.payments.map((method) => <span key={method} className="rounded-full bg-muted/65 px-2 py-0.5 text-[10px]">{method}</span>)}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
