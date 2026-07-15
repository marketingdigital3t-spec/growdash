import { Fragment, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Download, ChevronRight, ChevronDown, Target, ShoppingBag, Users } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { useDashboard } from "@/contexts/DashboardContext";
import { useAccountUtmMappingMap } from "@/hooks/useAccountUtmMapping";
import { attributeSalesToAds } from "@/lib/salesAttribution";
import { attributeLeadsToCampaigns, type LeadCounts, type LeadDealAttribution } from "@/lib/leadAttribution";
import type { Sale } from "@/hooks/useSales";
import type { InsightRow } from "@/hooks/useInsights";
import { ManualAttributionDialog } from "@/components/dashboard/ManualAttributionDialog";
import { LeadDetailSheet } from "@/components/dashboard/LeadDetailSheet";
import { CampaignLeadsSheet } from "@/components/dashboard/CampaignLeadsSheet";
import { classifyLead } from "@/hooks/useRDDealsForPeriod";
import { cn } from "@/lib/utils";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

type Mode = "sales" | "leads";
type LeadStatusFilter = "all" | "qualified" | "disqualified" | "lost" | "won" | "open";

interface AdRow {
  ad_id: string;
  ad_name: string;
  thumbnail_url: string | null;
  spend: number;
  leads: number;
  sales: number;
  revenue: number;
}

interface AdsetRow {
  adset_id: string;
  adset_name: string;
  spend: number;
  leads: number;
  sales: number;
  revenue: number;
  ads: AdRow[];
}

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  leads: number;
  sales: number;
  revenue: number;
  adsets: AdsetRow[];
}

function buildHierarchy(
  insights: InsightRow[],
  salesByAd: Map<string, Sale[]>,
  byCampaignSales: Map<string, { sales: Sale[]; revenue: number }>,
) {
  const campaigns = new Map<string, CampaignRow>();
  for (const r of insights) {
    if (!r.campaign_id) continue;
    let camp = campaigns.get(r.campaign_id);
    if (!camp) {
      camp = { campaign_id: r.campaign_id, campaign_name: r.campaign_name, spend: 0, leads: 0, sales: 0, revenue: 0, adsets: [] };
      campaigns.set(r.campaign_id, camp);
    }
    let adset = camp.adsets.find((a) => a.adset_name === r.adset_name);
    if (!adset) {
      adset = { adset_id: r.adset_name, adset_name: r.adset_name, spend: 0, leads: 0, sales: 0, revenue: 0, ads: [] };
      camp.adsets.push(adset);
    }
    let ad = adset.ads.find((a) => a.ad_id === r.ad_id);
    if (!ad) {
      ad = { ad_id: r.ad_id, ad_name: r.ad_name, thumbnail_url: r.thumbnail_url ?? null, spend: 0, leads: 0, sales: 0, revenue: 0 };
      adset.ads.push(ad);
    }
    ad.spend += r.spend;
    ad.leads += r.leads;
  }
  for (const camp of campaigns.values()) {
    for (const adset of camp.adsets) {
      for (const ad of adset.ads) {
        const list = salesByAd.get(ad.ad_id) ?? [];
        ad.sales = list.length;
        ad.revenue = list.reduce((s, x) => s + (Number(x.net_revenue) || 0), 0);
        adset.sales += ad.sales;
        adset.revenue += ad.revenue;
        adset.spend += ad.spend;
        adset.leads += ad.leads;
      }
      camp.sales += adset.sales;
      camp.revenue += adset.revenue;
      camp.spend += adset.spend;
      camp.leads += adset.leads;
    }
  }
  for (const [campaignId, agg] of byCampaignSales) {
    const camp = campaigns.get(campaignId);
    if (!camp) continue;
    const existingSales = camp.adsets.reduce((s, a) => s + a.sales, 0);
    if (agg.sales.length > existingSales) {
      const extra = agg.sales.length - existingSales;
      const extraRevenue = agg.revenue - camp.revenue;
      camp.sales += extra;
      if (extraRevenue > 0) camp.revenue += extraRevenue;
    }
  }
  return Array.from(campaigns.values());
}

// Modo Leads — só temos atribuição em nível de campanha (rd_deals não tem utm_content/term)
interface CampaignLeadRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  metaLeads: number;
  counts: LeadCounts;
}

const STATUS_LABEL: Record<LeadStatusFilter, string> = {
  all: "Todos",
  qualified: "Qualificados",
  disqualified: "Desqualificados",
  lost: "Perdidos",
  won: "Ganhos",
  open: "Em aberto",
};

export function CampaignResultsTable() {
  const { insights, sales, rdDeals } = useDashboard();
  const { map: mappingMap } = useAccountUtmMappingMap();

  const [mode, setMode] = useState<Mode>("sales");
  const [leadStatus, setLeadStatus] = useState<LeadStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showZero, setShowZero] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [openLead, setOpenLead] = useState<LeadDealAttribution | null>(null);
  const [openCampaignLeads, setOpenCampaignLeads] = useState<{ name: string; deals: LeadDealAttribution[] } | null>(null);

  const openLeadsForCampaign = (campaign_id: string, fallbackName: string) => {
    const agg = leadAttribution.byCampaign.get(campaign_id);
    setOpenCampaignLeads({
      name: agg?.campaign_name || fallbackName,
      deals: agg?.deals ?? [],
    });
  };

  // ===== Sales attribution (modo Vendas) =====
  const attribution = useMemo(
    () => attributeSalesToAds(sales, insights, mappingMap),
    [sales, insights, mappingMap],
  );
  const salesHierarchy = useMemo(
    () => buildHierarchy(insights, attribution.matched, attribution.byCampaign),
    [insights, attribution],
  );

  // ===== Leads attribution (modo Leads) =====
  const leadAttribution = useMemo(
    () => attributeLeadsToCampaigns(rdDeals ?? [], insights, mappingMap),
    [rdDeals, insights, mappingMap],
  );

  const leadHierarchy: CampaignLeadRow[] = useMemo(() => {
    // spend per campaign vem do insights
    const spendByCampaign = new Map<string, { spend: number; metaLeads: number; name: string }>();
    for (const r of insights) {
      if (!r.campaign_id) continue;
      const cur = spendByCampaign.get(r.campaign_id) || { spend: 0, metaLeads: 0, name: r.campaign_name };
      cur.spend += r.spend;
      cur.metaLeads += r.leads;
      cur.name = r.campaign_name;
      spendByCampaign.set(r.campaign_id, cur);
    }
    const rows: CampaignLeadRow[] = [];
    // união: campanhas com leads OU com spend
    const ids = new Set<string>([
      ...Array.from(leadAttribution.byCampaign.keys()),
      ...Array.from(spendByCampaign.keys()),
    ]);
    for (const id of ids) {
      const agg = leadAttribution.byCampaign.get(id);
      const sp = spendByCampaign.get(id);
      rows.push({
        campaign_id: id,
        campaign_name: agg?.campaign_name || sp?.name || id,
        spend: sp?.spend ?? 0,
        metaLeads: sp?.metaLeads ?? 0,
        counts: agg?.counts ?? { total: 0, won: 0, lost: 0, disqualified: 0, qualified: 0, open: 0 },
      });
    }
    return rows;
  }, [leadAttribution, insights]);

  // ===== Filtros & ordenação =====
  const filteredSales = useMemo(() => {
    let rows = salesHierarchy;
    if (!showZero) rows = rows.filter((c) => c.sales > 0);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.campaign_name.toLowerCase().includes(s) ||
          c.adsets.some((a) => a.adset_name.toLowerCase().includes(s) || a.ads.some((ad) => ad.ad_name.toLowerCase().includes(s))),
      );
    }
    return [...rows].sort((a, b) => b.sales - a.sales || b.revenue - a.revenue || b.spend - a.spend);
  }, [salesHierarchy, showZero, search]);

  const filteredLeads = useMemo(() => {
    let rows = leadHierarchy;
    const valueFor = (r: CampaignLeadRow): number => {
      if (leadStatus === "all") return r.counts.total;
      return r.counts[leadStatus] ?? 0;
    };
    if (!showZero) rows = rows.filter((r) => valueFor(r) > 0);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => r.campaign_name.toLowerCase().includes(s));
    }
    return [...rows].sort((a, b) => valueFor(b) - valueFor(a) || b.spend - a.spend);
  }, [leadHierarchy, leadStatus, showZero, search]);

  // Unmatched leads filtrados pelo status atual + busca
  const filteredUnmatchedLeads = useMemo(() => {
    let rows = leadAttribution.unmatched;
    if (leadStatus !== "all") rows = rows.filter((e) => e.bucket === leadStatus);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((e) =>
        (e.deal.contact_name || "").toLowerCase().includes(s) ||
        (e.deal.utm_campaign || "").toLowerCase().includes(s) ||
        (e.deal.utm_source || "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [leadAttribution.unmatched, leadStatus, search]);

  // Breakdown de razões de falha
  const failureBreakdown = useMemo(() => {
    const acc: Record<string, number> = { no_utm_campaign: 0, campaign_not_found: 0, account_no_insights: 0 };
    for (const e of leadAttribution.unmatched) {
      const r = e.failure_reason ?? "campaign_not_found";
      acc[r] = (acc[r] || 0) + 1;
    }
    return acc;
  }, [leadAttribution.unmatched]);

  // ===== KPIs no topo =====
  const salesTotals = useMemo(() => {
    const totalSales = attribution.perSale.filter((p) => p.level !== "unmatched").length;
    const totalRevenue = attribution.perSale
      .filter((p) => p.level !== "unmatched")
      .reduce((s, p) => s + (Number(p.sale.net_revenue) || 0), 0);
    const totalSpend = insights.reduce((s, r) => s + r.spend, 0);
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    return { totalSales, totalRevenue, totalSpend, roas, unmatched: attribution.unmatched.length };
  }, [attribution, insights]);

  const leadTotals = leadAttribution.totals;
  const leadConv = leadTotals.total > 0 ? (leadTotals.won / leadTotals.total) * 100 : 0;

  const exportCSV = () => {
    if (mode === "sales") {
      const headers = ["Nível", "Campanha", "Conjunto", "Criativo", "Vendas", "Receita", "Investido", "Leads", "CPA", "ROAS", "CPL"];
      const lines: string[] = [headers.join(",")];
      for (const c of filteredSales) {
        const cpa = c.sales > 0 ? c.spend / c.sales : 0;
        const roas = c.spend > 0 ? c.revenue / c.spend : 0;
        const cpl = c.leads > 0 ? c.spend / c.leads : 0;
        lines.push(["Campanha", c.campaign_name, "", "", c.sales, c.revenue.toFixed(2), c.spend.toFixed(2), c.leads, cpa.toFixed(2), roas.toFixed(2), cpl.toFixed(2)].join(","));
      }
      downloadCSV(lines, "resultados-vendas.csv");
    } else {
      const headers = ["Campanha", "Total Leads", "Qualificados", "Desqualificados", "Perdidos", "Ganhos", "Em aberto", "Investido", "CPL", "Taxa Conv. %"];
      const lines: string[] = [headers.join(",")];
      for (const r of filteredLeads) {
        const cpl = r.counts.total > 0 ? r.spend / r.counts.total : 0;
        const conv = r.counts.total > 0 ? (r.counts.won / r.counts.total) * 100 : 0;
        lines.push([
          `"${r.campaign_name.replace(/"/g, '""')}"`,
          r.counts.total, r.counts.qualified, r.counts.disqualified, r.counts.lost, r.counts.won, r.counts.open,
          r.spend.toFixed(2), cpl.toFixed(2), conv.toFixed(2),
        ].join(","));
      }
      downloadCSV(lines, "resultados-leads.csv");
    }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAdset = (id: string) => {
    setExpandedAdsets((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold">Resultados Campanhas e Criativos</h2>
          <p className="text-xs text-muted-foreground">
            {mode === "sales"
              ? "Vendas atribuídas via UTMs por conta — configure em Configurações."
              : "Leads do RD atribuídos a campanhas via utm_campaign. Identifica desqualificados, perdidos e qualificados."}
          </p>
        </div>
        {/* Mode toggle */}
        <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
          <button
            onClick={() => setMode("sales")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              mode === "sales" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Vendas
          </button>
          <button
            onClick={() => setMode("leads")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors",
              mode === "leads" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" /> Leads
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {mode === "sales" ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPI label="Vendas atribuídas" value={salesTotals.totalSales} />
          <KPI label="Receita" value={salesTotals.totalRevenue} money />
          <KPI label="Investido (Meta)" value={salesTotals.totalSpend} money />
          <KPI label="ROAS" value={salesTotals.roas} suffix="x" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <KPI label="Total de leads" value={leadTotals.total} />
          <KPI label="Qualificados" value={leadTotals.qualified} tone="green" />
          <KPI label="Desqualificados" value={leadTotals.disqualified} tone="yellow" />
          <KPI label="Perdidos" value={leadTotals.lost} tone="red" />
          <KPI label="Taxa de conversão" value={leadConv} suffix="%" decimals={1} />
        </div>
      )}

      {/* Sub-filter for leads */}
      {mode === "leads" && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {(Object.keys(STATUS_LABEL) as LeadStatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setLeadStatus(s)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md border transition-colors",
                leadStatus === s ? "bg-primary text-primary-foreground border-primary" : "bg-muted/30 hover:bg-muted/60 border-border",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">{mode === "sales" ? "Campanhas com vendas" : "Campanhas com leads"}</TabsTrigger>
          <TabsTrigger value="unmatched" className="gap-2">
            Não atribuídas
            {mode === "sales"
              ? salesTotals.unmatched > 0 && <Badge variant="destructive" className="text-[10px] h-4">{salesTotals.unmatched}</Badge>
              : filteredUnmatchedLeads.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-4">{filteredUnmatchedLeads.length}</Badge>
                )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-4">
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={mode === "sales" ? "Buscar campanha/conjunto/criativo..." : "Buscar campanha..."} className="pl-8 h-9 text-xs" />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch checked={showZero} onCheckedChange={setShowZero} id="showZero" />
                <label htmlFor="showZero" className="cursor-pointer text-muted-foreground">
                  {mode === "sales" ? "Mostrar sem vendas" : "Mostrar sem leads"}
                </label>
              </div>
              <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-3 w-3 mr-1" /> CSV</Button>
            </div>

            {mode === "sales" ? (
              <SalesTable
                filtered={filteredSales}
                expanded={expanded}
                onToggle={toggle}
                expandedAdsets={expandedAdsets}
                onToggleAdset={toggleAdset}
                onOpenLeads={openLeadsForCampaign}
              />
            ) : (
              <LeadsTable filtered={filteredLeads} statusFilter={leadStatus} onOpenLeads={openLeadsForCampaign} />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="unmatched" className="mt-4">
          <Card className="p-3">
            {mode === "sales" ? (
              attribution.unmatched.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Todas as vendas estão atribuídas. 🎉</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-muted/30">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-2 py-2 font-medium">Lead</th>
                        <th className="px-2 py-2 font-medium">Data</th>
                        <th className="px-2 py-2 font-medium">utm_source</th>
                        <th className="px-2 py-2 font-medium">utm_campaign</th>
                        <th className="px-2 py-2 font-medium">utm_content</th>
                        <th className="px-2 py-2 font-medium text-right">Valor</th>
                        <th className="px-2 py-2 w-32"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {attribution.unmatched.map((s) => (
                        <tr key={s.id} className="border-t hover:bg-muted/20">
                          <td className="px-2 py-2">
                            <div className="font-medium text-xs">{s.contact_name || s.contact_email || "(sem nome)"}</div>
                            {s.contact_name && s.contact_email && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{s.contact_email}</div>
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs text-muted-foreground">{s.sale_date}</td>
                          <td className="px-2 py-2 text-xs">{s.utm_source || "—"}</td>
                          <td className="px-2 py-2 text-xs">{s.utm_campaign || "—"}</td>
                          <td className="px-2 py-2 text-xs">{s.utm_content || "—"}</td>
                          <td className="px-2 py-2 text-right">{fmtMoney(s.net_revenue)}</td>
                          <td className="px-2 py-2 text-right">
                            <Button size="sm" variant="outline" onClick={() => setEditSale(s)}>
                              <Target className="h-3 w-3 mr-1" /> Atribuir
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : leadAttribution.unmatched.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Todos os leads estão atribuídos. 🎉</div>
            ) : (
              <div className="space-y-3">
                {/* Breakdown de motivos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-[10px] uppercase">Sem utm_campaign</div><div className="font-semibold text-base">{failureBreakdown.no_utm_campaign}</div></div>
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-[10px] uppercase">Campanha não encontrada</div><div className="font-semibold text-base">{failureBreakdown.campaign_not_found}</div></div>
                  <div className="rounded-md border p-2"><div className="text-muted-foreground text-[10px] uppercase">Conta sem insights</div><div className="font-semibold text-base">{failureBreakdown.account_no_insights}</div></div>
                </div>

                {filteredUnmatchedLeads.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Nenhum lead {leadStatus !== "all" ? STATUS_LABEL[leadStatus].toLowerCase() : ""} não atribuído.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-sm">
                      <thead className="bg-muted/30">
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Nome</th>
                          <th className="px-2 py-2 font-medium">Etapa atual</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                          <th className="px-2 py-2 font-medium">Data</th>
                          <th className="px-2 py-2 font-medium">utm_source</th>
                          <th className="px-2 py-2 font-medium">utm_campaign</th>
                          <th className="px-2 py-2 font-medium">utm_content</th>
                          <th className="px-2 py-2 font-medium">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUnmatchedLeads.slice(0, 300).map((e) => {
                          const d = e.deal;
                          return (
                            <tr key={d.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setOpenLead(e)}>
                              <td className="px-2 py-2 text-xs font-medium">
                                {d.contact_name || d.contact_email || (
                                  <span className="text-muted-foreground italic">sem nome ({d.id.slice(0, 6)})</span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs">{d.rd_stage_name || "—"}</td>
                              <td className="px-2 py-2 text-xs">
                                {e.bucket === "won" ? <Badge variant="default" className="text-[10px]">Ganho</Badge> :
                                  e.bucket === "disqualified" ? <Badge variant="secondary" className="text-[10px]">Desqualif.</Badge> :
                                  e.bucket === "lost" ? <Badge variant="destructive" className="text-[10px]">Perdido</Badge> :
                                  e.bucket === "qualified" ? <Badge variant="outline" className="text-[10px] border-green-500/40 text-green-500">Qualif.</Badge> :
                                  <Badge variant="outline" className="text-[10px]">Aberto</Badge>}
                              </td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">{d.lead_created_at?.slice(0, 10) || "—"}</td>
                              <td className="px-2 py-2 text-xs">{d.utm_source || "—"}</td>
                              <td className="px-2 py-2 text-xs">{d.utm_campaign || d.last_touch_utm_campaign || d.first_touch_utm_campaign || "—"}</td>
                              <td className="px-2 py-2 text-xs">{d.utm_content || "—"}</td>
                              <td className="px-2 py-2 text-xs text-yellow-500">{e.failure_reason === "no_utm_campaign" ? "sem utm" : e.failure_reason === "account_no_insights" ? "sem insights" : "não encontrada"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredUnmatchedLeads.length > 300 && (
                      <div className="text-xs text-muted-foreground p-3 text-center">Mostrando 300 de {filteredUnmatchedLeads.length}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <ManualAttributionDialog sale={editSale} open={!!editSale} onClose={() => setEditSale(null)} />
      <LeadDetailSheet entry={openLead} onClose={() => setOpenLead(null)} />
      <CampaignLeadsSheet
        open={!!openCampaignLeads}
        onClose={() => setOpenCampaignLeads(null)}
        campaignName={openCampaignLeads?.name ?? ""}
        deals={openCampaignLeads?.deals ?? []}
      />
    </div>
  );
}

function downloadCSV(lines: string[], filename: string) {
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function KPI({ label, value, money, suffix, decimals, tone }: { label: string; value: number; money?: boolean; suffix?: string; decimals?: number; tone?: "green" | "yellow" | "red" }) {
  const toneClass = tone === "green" ? "text-green-500" : tone === "yellow" ? "text-yellow-500" : tone === "red" ? "text-red-500" : "";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-semibold mt-1", toneClass)}>
        {money ? (
          <AnimatedNumber value={value} prefix="R$ " decimals={2} />
        ) : (
          <>
            <AnimatedNumber value={value} decimals={decimals ?? (value % 1 === 0 ? 0 : 2)} />
            {suffix && <span className="text-sm text-muted-foreground ml-1">{suffix}</span>}
          </>
        )}
      </div>
    </Card>
  );
}

// ============ Sales table (hierarquia completa) ============
function SalesTable({ filtered, expanded, onToggle, expandedAdsets, onToggleAdset, onOpenLeads }: {
  filtered: CampaignRow[]; expanded: Set<string>; onToggle: (id: string) => void;
  expandedAdsets: Set<string>; onToggleAdset: (id: string) => void;
  onOpenLeads: (campaign_id: string, fallbackName: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-muted/30">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-2 py-2 font-medium w-6"></th>
            <th className="px-2 py-2 font-medium">Nome</th>
            <th className="px-2 py-2 font-medium text-right">Vendas</th>
            <th className="px-2 py-2 font-medium text-right">Receita</th>
            <th className="px-2 py-2 font-medium text-right">Investido</th>
            <th className="px-2 py-2 font-medium text-right">CPA</th>
            <th className="px-2 py-2 font-medium text-right">ROAS</th>
            <th className="px-2 py-2 font-medium text-right">Leads</th>
            <th className="px-2 py-2 font-medium text-right">CPL</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma campanha com vendas atribuídas no período.</td></tr>
          ) : filtered.map((c) => (
            <CampaignRows
              key={c.campaign_id}
              camp={c}
              expanded={expanded.has(c.campaign_id)}
              onToggle={() => onToggle(c.campaign_id)}
              expandedAdsets={expandedAdsets}
              onToggleAdset={onToggleAdset}
              onOpenLeads={onOpenLeads}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Leads table (nível campanha) ============
function LeadsTable({ filtered, statusFilter, onOpenLeads }: { filtered: CampaignLeadRow[]; statusFilter: LeadStatusFilter; onOpenLeads: (campaign_id: string, fallbackName: string) => void }) {
  if (filtered.length === 0) {
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma campanha com leads atribuídos no período.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="bg-muted/30">
          <tr className="text-left text-xs text-muted-foreground">
            <th className="px-2 py-2 font-medium">Campanha</th>
            <th className="px-2 py-2 font-medium text-right">Total</th>
            <th className="px-2 py-2 font-medium text-right text-green-500">Qualificados</th>
            <th className="px-2 py-2 font-medium text-right text-yellow-500">Desqualif.</th>
            <th className="px-2 py-2 font-medium text-right text-red-500">Perdidos</th>
            <th className="px-2 py-2 font-medium text-right">Ganhos</th>
            <th className="px-2 py-2 font-medium text-right">Em aberto</th>
            <th className="px-2 py-2 font-medium text-right">Investido</th>
            <th className="px-2 py-2 font-medium text-right">CPL</th>
            <th className="px-2 py-2 font-medium text-right">Conv. %</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const cpl = r.counts.total > 0 ? r.spend / r.counts.total : 0;
            const conv = r.counts.total > 0 ? (r.counts.won / r.counts.total) * 100 : 0;
            const highlight = statusFilter !== "all";
            return (
              <tr key={r.campaign_id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => onOpenLeads(r.campaign_id, r.campaign_name)}>
                <td className="px-2 py-2 font-medium truncate max-w-[300px]">{r.campaign_name}</td>
                <td className="px-2 py-2 text-right">{r.counts.total}</td>
                <td className={cn("px-2 py-2 text-right text-green-500", highlight && statusFilter === "qualified" && "font-bold")}>{r.counts.qualified || "—"}</td>
                <td className={cn("px-2 py-2 text-right text-yellow-500", highlight && statusFilter === "disqualified" && "font-bold")}>{r.counts.disqualified || "—"}</td>
                <td className={cn("px-2 py-2 text-right text-red-500", highlight && statusFilter === "lost" && "font-bold")}>{r.counts.lost || "—"}</td>
                <td className={cn("px-2 py-2 text-right", highlight && statusFilter === "won" && "font-bold")}>{r.counts.won || "—"}</td>
                <td className={cn("px-2 py-2 text-right text-muted-foreground", highlight && statusFilter === "open" && "font-bold")}>{r.counts.open || "—"}</td>
                <td className="px-2 py-2 text-right text-xs">{fmtMoney(r.spend)}</td>
                <td className="px-2 py-2 text-right text-xs">{r.counts.total > 0 ? fmtMoney(cpl) : "—"}</td>
                <td className={cn("px-2 py-2 text-right text-xs", conv >= 10 && "text-green-500", conv > 0 && conv < 3 && "text-red-500")}>{r.counts.total > 0 ? conv.toFixed(1) + "%" : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CampaignRows({ camp, expanded, onToggle, expandedAdsets, onToggleAdset, onOpenLeads }: {
  camp: CampaignRow;
  expanded: boolean;
  onToggle: () => void;
  expandedAdsets: Set<string>;
  onToggleAdset: (id: string) => void;
  onOpenLeads: (campaign_id: string, fallbackName: string) => void;
}) {
  const cpa = camp.sales > 0 ? camp.spend / camp.sales : 0;
  const roas = camp.spend > 0 ? camp.revenue / camp.spend : 0;
  const cpl = camp.leads > 0 ? camp.spend / camp.leads : 0;
  return (
    <>
      <tr className="border-t hover:bg-muted/20 cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-2">{expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
        <td className="px-2 py-2 font-medium truncate max-w-[300px]">{camp.campaign_name}</td>
        <td className="px-2 py-2 text-right">{camp.sales > 0 ? <Badge variant="default" className="text-[10px]">{camp.sales}</Badge> : "—"}</td>
        <td className="px-2 py-2 text-right">{fmtMoney(camp.revenue)}</td>
        <td className="px-2 py-2 text-right">{fmtMoney(camp.spend)}</td>
        <td className="px-2 py-2 text-right">{camp.sales > 0 ? fmtMoney(cpa) : "—"}</td>
        <td className={cn("px-2 py-2 text-right", roas >= 2 && "text-green-500", roas > 0 && roas < 1 && "text-red-500")}>{roas > 0 ? roas.toFixed(2) + "x" : "—"}</td>
        <td className="px-2 py-2 text-right">
          <button
            className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            onClick={(e) => { e.stopPropagation(); onOpenLeads(camp.campaign_id, camp.campaign_name); }}
            disabled={camp.leads === 0}
          >
            {camp.leads}
          </button>
        </td>
        <td className="px-2 py-2 text-right">{camp.leads > 0 ? fmtMoney(cpl) : "—"}</td>
      </tr>
      {expanded && camp.adsets.map((adset) => {
        const adsetKey = `${camp.campaign_id}::${adset.adset_id}`;
        const adsetExpanded = expandedAdsets.has(adsetKey);
        const acpa = adset.sales > 0 ? adset.spend / adset.sales : 0;
        const aroas = adset.spend > 0 ? adset.revenue / adset.spend : 0;
        const acpl = adset.leads > 0 ? adset.spend / adset.leads : 0;
        return (
          <Fragment key={adsetKey}>
            <tr className="border-t bg-muted/10 hover:bg-muted/20 cursor-pointer" onClick={() => onToggleAdset(adsetKey)}>
              <td className="px-2 py-2 pl-6">{adsetExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</td>
              <td className="px-2 py-2 text-xs text-muted-foreground truncate max-w-[300px]">↳ {adset.adset_name}</td>
              <td className="px-2 py-2 text-right text-xs">{adset.sales || "—"}</td>
              <td className="px-2 py-2 text-right text-xs">{fmtMoney(adset.revenue)}</td>
              <td className="px-2 py-2 text-right text-xs">{fmtMoney(adset.spend)}</td>
              <td className="px-2 py-2 text-right text-xs">{adset.sales > 0 ? fmtMoney(acpa) : "—"}</td>
              <td className="px-2 py-2 text-right text-xs">{aroas > 0 ? aroas.toFixed(2) + "x" : "—"}</td>
              <td className="px-2 py-2 text-right text-xs">{adset.leads}</td>
              <td className="px-2 py-2 text-right text-xs">{adset.leads > 0 ? fmtMoney(acpl) : "—"}</td>
            </tr>
            {adsetExpanded && adset.ads.map((ad) => {
              const dcpa = ad.sales > 0 ? ad.spend / ad.sales : 0;
              const droas = ad.spend > 0 ? ad.revenue / ad.spend : 0;
              const dcpl = ad.leads > 0 ? ad.spend / ad.leads : 0;
              return (
                <tr key={ad.ad_id} className="border-t hover:bg-muted/20">
                  <td></td>
                  <td className="px-2 py-2 pl-12 text-xs flex items-center gap-2 truncate max-w-[300px]">
                    {ad.thumbnail_url && <img src={ad.thumbnail_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />}
                    <span className="truncate">{ad.ad_name}</span>
                  </td>
                  <td className="px-2 py-2 text-right text-xs">{ad.sales || "—"}</td>
                  <td className="px-2 py-2 text-right text-xs">{fmtMoney(ad.revenue)}</td>
                  <td className="px-2 py-2 text-right text-xs">{fmtMoney(ad.spend)}</td>
                  <td className="px-2 py-2 text-right text-xs">{ad.sales > 0 ? fmtMoney(dcpa) : "—"}</td>
                  <td className="px-2 py-2 text-right text-xs">{droas > 0 ? droas.toFixed(2) + "x" : "—"}</td>
                  <td className="px-2 py-2 text-right text-xs">{ad.leads}</td>
                  <td className="px-2 py-2 text-right text-xs">{ad.leads > 0 ? fmtMoney(dcpl) : "—"}</td>
                </tr>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
