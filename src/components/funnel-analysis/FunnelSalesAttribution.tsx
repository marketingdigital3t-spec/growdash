import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, TriangleAlert } from "lucide-react";
import type { Sale } from "@/hooks/useSales";
import type { InsightRow } from "@/hooks/useInsights";
import { attributeSalesToAds } from "@/lib/salesAttribution";
import { attributeRDOpportunity, attributeRDOpportunities } from "@/lib/opportunityAttribution";
import type { RDDeal } from "@/hooks/useRDDeals";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Shows the closed-loop sale attribution for exactly the account and period
 * selected in Funnel Analysis. UTMs are intentionally shown, not inferred. */
export function FunnelSalesAttribution({ sales, insights = [], deals = [] }: { sales: Sale[]; insights?: InsightRow[]; deals?: RDDeal[] }) {
  const attribution = attributeSalesToAds(sales, insights);
  const insightByAd = new Map(insights.map((row) => [row.ad_id, row]));
  const insightByCampaign = new Map<string, InsightRow>();
  for (const row of insights) if (row.campaign_id && !insightByCampaign.has(row.campaign_id)) insightByCampaign.set(row.campaign_id, row);
  const rowsMap = new Map<string, { campaign: string; adset: string; creative: string; sales: number; revenue: number; payments: Set<string>; tracked: boolean }>();
  for (const item of attribution.perSale) {
    if (item.sale.status !== "confirmed") continue;
    const ad = item.ad_id ? insightByAd.get(item.ad_id) : undefined;
    const campaignRow = item.campaign_id ? insightByCampaign.get(item.campaign_id) : undefined;
    const campaign = ad?.campaign_name?.trim() || campaignRow?.campaign_name?.trim() || item.sale.utm_campaign?.trim() || item.sale.rd_campaign_name?.trim() || "Não atribuída";
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
  const opportunityRows = attributeRDOpportunities(deals, insights);
  const salesByDeal = new Map(sales.filter((sale) => sale.status === "confirmed" && sale.rd_deal_id).map((sale) => [sale.rd_deal_id!, sale]));
  const opportunityMap = new Map<string, { campaign: string; adset: string; creative: string; opportunities: number; leads: number; sales: number; revenue: number; pipeline: number; statuses: Set<string> }>();
  for (const item of opportunityRows) {
    const key = `${item.campaignName}\u0000${item.adsetName}\u0000${item.adName}`;
    const row = opportunityMap.get(key) ?? { campaign: item.campaignName, adset: item.adsetName, creative: item.adName, opportunities: 0, leads: 0, sales: 0, revenue: 0, pipeline: 0, statuses: new Set<string>() };
    row.opportunities += 1;
    row.pipeline += Number(item.deal.amount_total || 0);
    row.statuses.add(item.status);
    const sale = salesByDeal.get(item.deal.rd_deal_id);
    if (sale) { row.sales += Math.max(1, Number(sale.quantity || 1)); row.revenue += Number(sale.net_revenue || 0); }
    opportunityMap.set(key, row);
  }
  for (const deal of deals) {
    const attributed = attributeRDOpportunity(deal, insights);
    const key = `${attributed.campaignName}\u0000${attributed.adsetName}\u0000${attributed.adName}`;
    const row = opportunityMap.get(key);
    if (row) row.leads += 1;
  }
  const opportunityTable = Array.from(opportunityMap.values()).map((row) => ({ ...row, rate: row.leads > 0 ? row.opportunities / row.leads * 100 : 0, statuses: Array.from(row.statuses) })).sort((a, b) => b.opportunities - a.opportunities || b.rate - a.rate || b.sales - a.sales || b.revenue - a.revenue);
  const topOpportunity = opportunityTable[0];

  return (
    <Card className="gd-analysis-card min-w-0 bg-card/60 border-border/40">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" />10. Vendas e oportunidades por campanha</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Cruza vendas confirmadas e negócios atualmente na etapa Oportunidade do RD com a hierarquia real da Meta.</p>
        </div>
        <Badge variant="outline" className="shrink-0 tabular-nums">Rastreamento {trackingScore.toFixed(0)}% · {attributedSales.toLocaleString("pt-BR")}/{totalSales.toLocaleString("pt-BR")}</Badge>
      </CardHeader>
      <CardContent className="min-w-0">
        {topOpportunity && <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[.06] p-3 text-xs"><b className="text-emerald-400">Maior oportunidade de venda</b><p className="mt-1 font-semibold">{topOpportunity.campaign} · {topOpportunity.adset} · {topOpportunity.creative}</p><p className="mt-1 text-muted-foreground">{topOpportunity.opportunities} oportunidade(s) · {topOpportunity.sales} venda(s) · {topOpportunity.rate.toFixed(1)}% de avanço · {money(topOpportunity.pipeline)} em negociação</p></div>}
        <Tabs defaultValue="sales">
          <TabsList><TabsTrigger value="sales">Vendas confirmadas</TabsTrigger><TabsTrigger value="opportunities">Oportunidades RD ({opportunityRows.length})</TabsTrigger></TabsList>
          <TabsContent value="sales" className="mt-4">
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
          </TabsContent>
          <TabsContent value="opportunities" className="mt-4">
            {!opportunityTable.length ? <div className="flex min-h-40 items-center justify-center text-center text-sm text-muted-foreground">Nenhuma oportunidade RD no período selecionado.</div> : <div className="overflow-x-auto rounded-xl border border-border/50"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-muted/35 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Campanha</th><th className="px-4 py-3">Conjunto</th><th className="px-4 py-3">Anúncio</th><th className="px-4 py-3 text-right">Oportunidades</th><th className="px-4 py-3 text-right">Taxa</th><th className="px-4 py-3 text-right">Vendas</th><th className="px-4 py-3 text-right">Receita</th><th className="px-4 py-3 text-right">Em negociação</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-border/45">{opportunityTable.map((row) => <tr key={`${row.campaign}-${row.adset}-${row.creative}`}><td className="max-w-[220px] truncate px-4 py-3 font-medium" title={row.campaign}>{row.campaign}</td><td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground" title={row.adset}>{row.adset}</td><td className="max-w-[220px] truncate px-4 py-3 text-muted-foreground" title={row.creative}>{row.creative}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{row.opportunities}</td><td className="px-4 py-3 text-right tabular-nums">{row.rate.toFixed(1)}%</td><td className="px-4 py-3 text-right tabular-nums">{row.sales}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.revenue)}</td><td className="px-4 py-3 text-right tabular-nums">{money(row.pipeline)}</td><td className="px-4 py-3">{row.statuses.includes("unmatched") ? <span className="text-amber-500">Inconclusiva</span> : <span className="text-emerald-400">Atribuída</span>}</td></tr>)}</tbody></table></div>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
