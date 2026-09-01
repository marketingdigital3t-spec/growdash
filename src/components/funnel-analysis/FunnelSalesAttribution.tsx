import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TriangleAlert } from "lucide-react";
import type { Sale } from "@/hooks/useSales";
import type { InsightRow } from "@/hooks/useInsights";
import { attributeSalesToAds } from "@/lib/salesAttribution";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Shows the closed-loop sale attribution for exactly the account and period
 * selected in Funnel Analysis. UTMs are intentionally shown, not inferred. */
export function FunnelSalesAttribution({ sales, insights = [] }: { sales: Sale[]; insights?: InsightRow[] }) {
  const attribution = attributeSalesToAds(sales, insights);
  const insightByAd = new Map(insights.map((row) => [row.ad_id, row]));
  const rowsMap = new Map<string, { campaign: string; adset: string; creative: string; sales: number; revenue: number; payments: Set<string>; tracked: boolean }>();
  for (const item of attribution.perSale) {
    if (item.sale.status !== "confirmed") continue;
    const ad = item.ad_id ? insightByAd.get(item.ad_id) : undefined;
    const campaign = ad?.campaign_name?.trim() || item.sale.utm_campaign?.trim() || item.sale.rd_campaign_name?.trim() || "Não atribuída";
    const adset = ad?.adset_name?.trim() || item.adset_id?.trim() || "Conjunto não identificado";
    const creative = ad?.ad_name?.trim() || item.sale.utm_content?.trim() || item.sale.ad_id?.trim() || "Criativo não identificado";
    const key = `${campaign}\u0000${adset}\u0000${creative}`;
    const row = rowsMap.get(key) ?? { campaign, adset, creative, sales: 0, revenue: 0, payments: new Set<string>(), tracked: item.level !== "unmatched" };
    row.sales += Math.max(1, Number(item.sale.quantity ?? 1));
    row.revenue += Number(item.sale.net_revenue ?? 0);
    row.payments.add(item.sale.payment_method || "outros");
    row.tracked = row.tracked || item.level !== "unmatched";
    rowsMap.set(key, row);
  }
  const rows = Array.from(rowsMap.values()).map((row) => ({ ...row, payments: Array.from(row.payments) })).sort((a, b) => b.revenue - a.revenue || b.sales - a.sales);
  const attributed = rows.filter((row) => row.campaign !== "Não atribuída" && row.adset !== "Conjunto não identificado" && row.creative !== "Criativo não identificado");
  const attributedSales = attributed.reduce((total, row) => total + row.sales, 0);
  const totalSales = rows.reduce((total, row) => total + row.sales, 0);
  const trackingScore = totalSales > 0 ? (attributedSales / totalSales) * 100 : 0;

  return (
    <Card className="gd-analysis-card min-w-0 bg-card/60 border-border/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />10. Vendas por campanha e criativo</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Cruza a venda confirmada do RD com a campanha e o anúncio reais da Meta. Quando não houver correspondência, a linha fica identificada como não atribuída.</p>
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
                  <th className="px-4 py-3 font-semibold">Conjunto</th>
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
                  const untracked = !row.tracked || row.campaign === "Não atribuída" || row.adset === "Conjunto não identificado" || row.creative === "Criativo não identificado";
                  // Sem campanha e criativo identificados não existe base
                  // confiável para realocar orçamento, mesmo com muitas vendas.
                  const decision = untracked ? "Corrigir rastreamento" : row.sales >= 2 ? "Candidato a escala" : "Validar com mais dados";
                  return <tr key={`${row.campaign}-${row.creative}`} className="transition-colors hover:bg-muted/25">
                    <td className="max-w-[250px] truncate px-4 py-3 font-medium" title={row.campaign}>{row.campaign}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground" title={row.adset}>{row.adset}</td>
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
