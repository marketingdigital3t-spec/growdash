import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useSales } from "@/hooks/useSales";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCw,
  X,
  Megaphone,
  BarChart3,
  Pencil,
  RotateCcw,
  ShieldCheck,
  FolderKanban,
  Layers3,
  RectangleHorizontal,
  SlidersHorizontal,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignDetailSheet } from "@/components/campaigns/CampaignDetailSheet";
import { EditableMetaEntity, MetaEntityEditor } from "@/components/campaigns/MetaEntityEditor";
import { ResizableHead, StatusDot, normalizeStatus, useColWidths } from "@/components/dashboard/ResizableTableHelpers";
import { cn } from "@/lib/utils";
import { getStatusBadge } from "@/lib/status";

type CampSortKey = "name" | "budget" | "salesCount" | "cpa" | "spend" | "leads" | "profit" | "roi" | "cpl" | "ctr" | "impressions";
type CampColKey = "check" | "name" | "delivery" | "budget" | "sales" | "cpa" | "spend" | "leads" | "profit" | "roi" | "cpl" | "ctr" | "impressions" | "actions";
type AdsetColKey = "name" | "campaign" | "budget" | "spend" | "leads" | "cpl" | "clicks" | "impressions";
type AdColKey = "name" | "adset" | "campaign" | "spend" | "leads" | "cpl" | "clicks" | "ctr" | "impressions";

const CAMP_DEFAULTS: Record<CampColKey, number> = {
  check: 44, name: 300, delivery: 156, budget: 120, sales: 90, cpa: 110, spend: 120, leads: 90,
  profit: 130, roi: 100, cpl: 110, ctr: 100, impressions: 120, actions: 86,
};
const ADSET_DEFAULTS: Record<AdsetColKey, number> = {
  name: 240, campaign: 220, budget: 130, spend: 120, leads: 90, cpl: 110, clicks: 100, impressions: 120,
};
const AD_DEFAULTS: Record<AdColKey, number> = {
  name: 260, adset: 200, campaign: 200, spend: 120, leads: 90, cpl: 110, clicks: 100, ctr: 100, impressions: 120,
};

export default function Campaigns() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("campaigns");
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableMetaEntity | null>(null);
  const [sortKey, setSortKey] = useState<CampSortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  const {
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate,
    endDate,
    adAccountId: selectedAccount,
    setAdAccountId: setSelectedAccount,
  } = useGlobalFilters();
  const { data: adAccounts = [] } = useAdAccounts();
  const { data: sales = [] } = useSales({ startDate, endDate, adAccountId: selectedAccount === "all" ? undefined : selectedAccount });

  const camp = useColWidths<CampColKey>(CAMP_DEFAULTS, "campaigns-cols-v1");
  const adset = useColWidths<AdsetColKey>(ADSET_DEFAULTS, "campaigns-adset-cols-v1");
  const ad = useColWidths<AdColKey>(AD_DEFAULTS, "campaigns-ad-cols-v1");

  const handleSort = (key: CampSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const { data: campaigns = [], isLoading, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["campaigns_full", selectedAccount, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select(`
          id, name, ad_account_id, status, created_at,
          adsets(
            id, name, daily_budget, status,
            ads(
              id, name, thumbnail_url, status,
              insights(spend, leads, clicks, impressions, ctr, cpm, cpl, frequency, conversion_rate, health_score, date)
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (selectedAccount !== "all") {
        query = query.eq("ad_account_id", selectedAccount);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((c: any) => {
        let spend = 0, leads = 0, clicks = 0, impressions = 0;
        const adsets = c.adsets || [];
        let budget = 0;

        for (const adset of adsets) {
          budget += adset.daily_budget ?? 0;
          for (const ad of adset.ads || []) {
            for (const i of ad.insights || []) {
              if (startDate && i.date < startDate.toISOString().split("T")[0]) continue;
              if (endDate && i.date > endDate.toISOString().split("T")[0]) continue;
              spend += i.spend ?? 0;
              leads += i.leads ?? 0;
              clicks += i.clicks ?? 0;
              impressions += i.impressions ?? 0;
            }
          }
        }

        const campaignSales = sales.filter(s => s.campaign_ids && s.campaign_ids.includes(c.id));
        const salesCount = campaignSales.length;
        const revenue = campaignSales.reduce((sum, s) => sum + (s.net_revenue ?? 0), 0);
        const profit = revenue - spend;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        const cpa = salesCount > 0 ? spend / salesCount : 0;
        const cpl = leads > 0 ? spend / leads : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

        return { ...c, adsets, budget, spend, leads, clicks, impressions, salesCount, revenue, profit, roi, cpa, cpl, ctr };
      });
    },
  });

  const filtered = useMemo(() => {
    let result = campaigns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) => c.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter((c: any) => normalizeStatus(c.status) === statusFilter);
    }
    result = [...result].sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return result;
  }, [campaigns, search, statusFilter, sortKey, sortAsc]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c: any) => c.id)));
  };

  const totals = useMemo(() => filtered.reduce(
    (acc: any, c: any) => ({
      spend: acc.spend + c.spend, leads: acc.leads + c.leads,
      salesCount: acc.salesCount + c.salesCount, revenue: acc.revenue + c.revenue,
      profit: acc.profit + c.profit, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
    }),
    { spend: 0, leads: 0, salesCount: 0, revenue: 0, profit: 0, impressions: 0, clicks: 0 }
  ), [filtered]);

  const activeCampaigns = useMemo(() => campaigns.filter((campaign: any) => {
    const matchesSearch = !search || campaign.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && normalizeStatus(campaign.status) === "ACTIVE";
  }).length, [campaigns, search]);

  const selectedCampaign = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return filtered.find((campaign: any) => campaign.id === id) ?? null;
  }, [filtered, selectedIds]);

  const selectedAdsets = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return filtered
      .filter((c: any) => selectedIds.has(c.id))
      .flatMap((c: any) =>
        (c.adsets || [])
          .filter((a: any) => statusFilter === "all" || normalizeStatus(a.status) === statusFilter)
          .map((adset: any) => {
            let spend = 0, leads = 0, clicks = 0, impressions = 0;
            for (const ad of adset.ads || []) {
              for (const i of ad.insights || []) {
                spend += i.spend ?? 0; leads += i.leads ?? 0;
                clicks += i.clicks ?? 0; impressions += i.impressions ?? 0;
              }
            }
            return { ...adset, campaignName: c.name, spend, leads, clicks, impressions };
          })
      );
  }, [filtered, selectedIds, statusFilter]);

  const selectedAds = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return filtered
      .filter((c: any) => selectedIds.has(c.id))
      .flatMap((c: any) =>
        (c.adsets || []).flatMap((adset: any) =>
          (adset.ads || [])
            .filter((a: any) => statusFilter === "all" || normalizeStatus(a.status) === statusFilter)
            .map((ad: any) => {
              let spend = 0, leads = 0, clicks = 0, impressions = 0;
              for (const i of ad.insights || []) {
                spend += i.spend ?? 0; leads += i.leads ?? 0;
                clicks += i.clicks ?? 0; impressions += i.impressions ?? 0;
              }
              return { ...ad, adsetName: adset.name, campaignName: c.name, spend, leads, clicks, impressions };
            })
        )
      );
  }, [filtered, selectedIds, statusFilter]);

  const colorClass = (v: number) => v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "";
  const sortBg = (k: CampSortKey) => sortKey === k ? "bg-primary/5" : "";
  const cellW = (k: CampColKey) => ({ width: camp.colWidths[k], minWidth: camp.colWidths[k], maxWidth: camp.colWidths[k] });
  const adsetCellW = (k: AdsetColKey) => ({ width: adset.colWidths[k], minWidth: adset.colWidths[k], maxWidth: adset.colWidths[k] });
  const adCellW = (k: AdColKey) => ({ width: ad.colWidths[k], minWidth: ad.colWidths[k], maxWidth: ad.colWidths[k] });

  return (
    <MotionPage className="overflow-hidden rounded-xl border border-[#d9d3c9] bg-white shadow-sm">
      <MotionItem className="border-b border-[#ded8ce] bg-gradient-to-r from-[#fffdf7] via-white to-[#f5efe0] px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#1d1b17] text-[#f2c94c] shadow-sm">
              <Megaphone className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight">Campanhas</h1>
                <Badge className="border-[#dfc36f] bg-[#fff4cc] text-[#72530b] hover:bg-[#fff4cc]">
                  {filtered.length} campanhas
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">Gerenciador integrado à Meta Ads</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {adAccounts.length > 0 && (
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="h-9 w-full border-[#d7d0c4] bg-white sm:w-[260px]">
                  <SelectValue placeholder="Conta de anúncio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas de anúncio</SelectItem>
                  {adAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {dataUpdatedAt ? `Atualizado às ${new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando dados"}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9 gap-2 bg-white">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} /> Atualizar
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem className="border-b border-[#e2ddd5] bg-[#faf8f4] px-3 py-2 sm:px-4">
        <div className="growdash-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter("all")}
            className={cn("h-9 shrink-0 gap-2 bg-white", statusFilter === "all" && "border-[#c99b23] bg-[#fff7dc] text-[#6c4b06]")}
          >
            <FolderKanban className="h-4 w-4" /> Todos os anúncios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter("ACTIVE")}
            className={cn("h-9 shrink-0 gap-2 bg-white", statusFilter === "ACTIVE" && "border-[#c99b23] bg-[#fff7dc] text-[#6c4b06]")}
          >
            <CheckCircle2 className="h-4 w-4" /> Ativos ({activeCampaigns})
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSortKey("roi"); setSortAsc(false); }} className="h-9 shrink-0 gap-2 bg-white">
            <BarChart3 className="h-4 w-4" /> Desempenho e ROAS
          </Button>
          <div className="ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground lg:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Alterações exigem confirmação e são enviadas pelo backend seguro.
          </div>
        </div>
      </MotionItem>

      <MotionItem className="border-b border-[#e2ddd5] bg-[#f1eee8] p-2 sm:p-3">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquise por nome da campanha"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-[#ded8ce] bg-white pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full bg-white sm:w-[180px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ACTIVE"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ativa</span></SelectItem>
                  <SelectItem value="PAUSED"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Pausada</span></SelectItem>
                  <SelectItem value="ARCHIVED"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> Arquivada</span></SelectItem>
                  <SelectItem value="IN_PROCESS"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> Em análise</span></SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { camp.reset(); adset.reset(); ad.reset(); }} className="h-9 gap-2 bg-white" title="Restaurar largura das colunas">
                <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Redefinir colunas</span>
              </Button>
            </div>
            <DateFilterBar
              preset={preset} onPresetChange={setPreset}
              customRange={customRange} onCustomRangeChange={setCustomRange}
              startDate={startDate} endDate={endDate}
              adAccounts={[]} selectedAccount="" onAccountChange={() => {}}
            />
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="growdash-scrollbar h-auto w-full justify-start overflow-x-auto rounded-none border-b border-[#d8d2c8] bg-[#f7f4ed] p-0">
            <TabsTrigger value="campaigns" className="h-11 min-w-[180px] shrink-0 justify-start gap-2 rounded-none border-r border-[#ddd7cd] px-4 data-[state=active]:bg-white data-[state=active]:text-[#75540a] data-[state=active]:shadow-[inset_0_-3px_0_#d2a52d]">
              <FolderKanban className="h-4 w-4" /> Campanhas
              {selectedIds.size > 0 && <Badge className="ml-auto bg-[#d7aa30] text-[#2d2107]">{selectedIds.size}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="adsets" disabled={selectedIds.size === 0} className="h-11 min-w-[220px] shrink-0 justify-start gap-2 rounded-none border-r border-[#ddd7cd] px-4 data-[state=active]:bg-white data-[state=active]:text-[#75540a] data-[state=active]:shadow-[inset_0_-3px_0_#d2a52d]">
              <Layers3 className="h-4 w-4" /> Conjuntos de anúncios {selectedIds.size > 0 && `(${selectedAdsets.length})`}
            </TabsTrigger>
            <TabsTrigger value="ads" disabled={selectedIds.size === 0} className="h-11 min-w-[180px] shrink-0 justify-start gap-2 rounded-none px-4 data-[state=active]:bg-white data-[state=active]:text-[#75540a] data-[state=active]:shadow-[inset_0_-3px_0_#d2a52d]">
              <RectangleHorizontal className="h-4 w-4" /> Anúncios {selectedIds.size > 0 && `(${selectedAds.length})`}
            </TabsTrigger>
          </TabsList>

          <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-[#ddd7cd] bg-white px-3 py-2">
            <Button
              size="sm"
              disabled={!selectedCampaign}
              onClick={() => selectedCampaign && setEditingEntity({ type: "campaign", id: selectedCampaign.id, name: selectedCampaign.name, status: selectedCampaign.status })}
              className="h-8 gap-2 bg-[#c99519] text-[#2d2107] hover:bg-[#d7aa30]"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedCampaign} onClick={() => selectedCampaign && setDetailCampaignId(selectedCampaign.id)} className="h-8 gap-2">
              <Eye className="h-4 w-4" /> Ver desempenho
            </Button>
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedIds.size} selecionada{selectedIds.size > 1 ? "s" : ""}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-8 gap-1 text-xs">
                    <X className="h-3 w-3" /> Limpar
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" /> Colunas redimensionáveis
            </div>
          </div>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="m-0">
            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{isLoading ? "Carregando..." : "Nenhuma campanha encontrada. Sincronize seus dados nas Configurações."}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden rounded-none border-0 shadow-none">
                <div className="growdash-scrollbar overflow-x-auto">
                  <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                    <TableHeader>
                      <TableRow className="h-11 border-b border-[#d7d1c7] bg-[#f3f0ea] hover:bg-[#f3f0ea]">
                        <ResizableHead colKey="check" width={camp.colWidths.check} onResize={camp.startResize("check")}>
                          <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                        </ResizableHead>
                        <ResizableHead colKey="name" width={camp.colWidths.name} onResize={camp.startResize("name")} sortable sortableKey="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort}>Campanha</ResizableHead>
                        <ResizableHead colKey="delivery" width={camp.colWidths.delivery} onResize={camp.startResize("delivery")}>Veiculação</ResizableHead>
                        <ResizableHead colKey="budget" width={camp.colWidths.budget} onResize={camp.startResize("budget")} sortable sortableKey="budget" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Orçamento</ResizableHead>
                        <ResizableHead colKey="sales" width={camp.colWidths.sales} onResize={camp.startResize("sales")} sortable sortableKey="salesCount" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Vendas</ResizableHead>
                        <ResizableHead colKey="cpa" width={camp.colWidths.cpa} onResize={camp.startResize("cpa")} sortable sortableKey="cpa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPA</ResizableHead>
                        <ResizableHead colKey="spend" width={camp.colWidths.spend} onResize={camp.startResize("spend")} sortable sortableKey="spend" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Gastos</ResizableHead>
                        <ResizableHead colKey="leads" width={camp.colWidths.leads} onResize={camp.startResize("leads")} sortable sortableKey="leads" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Leads</ResizableHead>
                        <ResizableHead colKey="profit" width={camp.colWidths.profit} onResize={camp.startResize("profit")} sortable sortableKey="profit" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Lucro</ResizableHead>
                        <ResizableHead colKey="roi" width={camp.colWidths.roi} onResize={camp.startResize("roi")} sortable sortableKey="roi" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">ROI</ResizableHead>
                        <ResizableHead colKey="cpl" width={camp.colWidths.cpl} onResize={camp.startResize("cpl")} sortable sortableKey="cpl" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPL</ResizableHead>
                        <ResizableHead colKey="ctr" width={camp.colWidths.ctr} onResize={camp.startResize("ctr")} sortable sortableKey="ctr" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CTR</ResizableHead>
                        <ResizableHead colKey="impressions" width={camp.colWidths.impressions} onResize={camp.startResize("impressions")} sortable sortableKey="impressions" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Impressões</ResizableHead>
                        <ResizableHead colKey="actions" width={camp.colWidths.actions} onResize={camp.startResize("actions")}>{""}</ResizableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {filtered.map((c: any) => (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`h-12 border-b border-[#e8e3db] transition-colors hover:bg-[#fff9e8] cursor-pointer ${selectedIds.has(c.id) ? "bg-[#fff4cf]" : "odd:bg-white even:bg-[#fbfaf8]"}`}
                            onClick={() => toggleSelect(c.id)}
                          >
                            <TableCell style={cellW("check")} onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                            </TableCell>
                            <TableCell style={cellW("name")} className="font-medium">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate font-semibold text-[#6f5311]" title={c.name}>{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell style={cellW("delivery")} onClick={(event) => event.stopPropagation()}>
                              <div className={cn("flex items-center gap-2 text-xs font-semibold", getStatusBadge(c.status).textColor)}>
                                <button
                                  type="button"
                                  onClick={() => setEditingEntity({ type: "campaign", id: c.id, name: c.name, status: c.status })}
                                  className={cn(
                                    "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                                    normalizeStatus(c.status) === "ACTIVE"
                                      ? "border-[#b98914] bg-[#d8aa2d]"
                                      : "border-[#c8c2b8] bg-[#e7e3dc]",
                                  )}
                                  title="Editar status na Meta Ads"
                                >
                                  <span className={cn(
                                    "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                                    normalizeStatus(c.status) === "ACTIVE" ? "left-[17px]" : "left-0.5",
                                  )} />
                                </button>
                                <span>{getStatusBadge(c.status).label}</span>
                              </div>
                            </TableCell>
                            <TableCell style={cellW("budget")} className={cn("text-right tabular-nums text-sm", sortBg("budget"))}><AnimatedNumber value={c.budget} prefix="R$ " decimals={2} /></TableCell>
                            <TableCell style={cellW("sales")} className={cn("text-right tabular-nums text-sm", sortBg("salesCount"))}><AnimatedNumber value={c.salesCount} decimals={0} /></TableCell>
                            <TableCell style={cellW("cpa")} className={cn("text-right tabular-nums text-sm", sortBg("cpa"))}><AnimatedNumber value={c.cpa} prefix="R$ " decimals={2} /></TableCell>
                            <TableCell style={cellW("spend")} className={cn("text-right tabular-nums text-sm", sortBg("spend"))}><AnimatedNumber value={c.spend} prefix="R$ " decimals={2} /></TableCell>
                            <TableCell style={cellW("leads")} className={cn("text-right tabular-nums text-sm", sortBg("leads"))}><AnimatedNumber value={c.leads} decimals={0} /></TableCell>
                            <TableCell style={cellW("profit")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.profit), sortBg("profit"))}><AnimatedNumber value={c.profit} prefix="R$ " decimals={2} /></TableCell>
                            <TableCell style={cellW("roi")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.roi), sortBg("roi"))}><AnimatedNumber value={c.roi} suffix="%" decimals={1} /></TableCell>
                            <TableCell style={cellW("cpl")} className={cn("text-right tabular-nums text-sm", sortBg("cpl"))}><AnimatedNumber value={c.cpl} prefix="R$ " decimals={2} /></TableCell>
                            <TableCell style={cellW("ctr")} className={cn("text-right tabular-nums text-sm", sortBg("ctr"))}><AnimatedNumber value={c.ctr} suffix="%" decimals={2} /></TableCell>
                            <TableCell style={cellW("impressions")} className={cn("text-right tabular-nums text-sm", sortBg("impressions"))}><AnimatedNumber value={c.impressions} decimals={0} /></TableCell>
                            <TableCell style={cellW("actions")} onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailCampaignId(c.id)} title="Ver detalhes">
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingEntity({ type: "campaign", id: c.id, name: c.name, status: c.status })} title="Editar na Meta Ads">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t border-[#d7d1c7] bg-[#f7f4ed] px-4 py-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="font-semibold">{filtered.length} campanha{filtered.length !== 1 ? "s" : ""}</span>
                    <span>Vendas: <strong><AnimatedNumber value={totals.salesCount} decimals={0} /></strong></span>
                    <span>Gastos: <strong><AnimatedNumber value={totals.spend} prefix="R$ " decimals={2} /></strong></span>
                    <span>Faturamento: <strong><AnimatedNumber value={totals.revenue} prefix="R$ " decimals={2} /></strong></span>
                    <span className={colorClass(totals.profit)}>Lucro: <strong><AnimatedNumber value={totals.profit} prefix="R$ " decimals={2} /></strong></span>
                    <span>Leads: <strong><AnimatedNumber value={totals.leads} decimals={0} /></strong></span>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Adsets Tab */}
          <TabsContent value="adsets" className="m-0">
            <Card className="overflow-hidden rounded-none border-0 shadow-none">
              <div className="growdash-scrollbar overflow-x-auto">
                <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                  <TableHeader>
                    <TableRow className="h-11 bg-[#f3f0ea] hover:bg-[#f3f0ea]">
                      <ResizableHead colKey="name" width={adset.colWidths.name} onResize={adset.startResize("name")}>Conjunto</ResizableHead>
                      <ResizableHead colKey="campaign" width={adset.colWidths.campaign} onResize={adset.startResize("campaign")}>Campanha</ResizableHead>
                      <ResizableHead colKey="budget" width={adset.colWidths.budget} onResize={adset.startResize("budget")} align="right">Orçamento Diário</ResizableHead>
                      <ResizableHead colKey="spend" width={adset.colWidths.spend} onResize={adset.startResize("spend")} align="right">Gastos</ResizableHead>
                      <ResizableHead colKey="leads" width={adset.colWidths.leads} onResize={adset.startResize("leads")} align="right">Leads</ResizableHead>
                      <ResizableHead colKey="cpl" width={adset.colWidths.cpl} onResize={adset.startResize("cpl")} align="right">CPL</ResizableHead>
                      <ResizableHead colKey="clicks" width={adset.colWidths.clicks} onResize={adset.startResize("clicks")} align="right">Cliques</ResizableHead>
                      <ResizableHead colKey="impressions" width={adset.colWidths.impressions} onResize={adset.startResize("impressions")} align="right">Impressões</ResizableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAdsets.map((a: any) => (
                      <TableRow key={a.id} className="h-12 odd:bg-white even:bg-[#fbfaf8] hover:bg-[#fff9e8]">
                        <TableCell style={adsetCellW("name")} className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusDot status={a.status} />
                            <span className="truncate" title={a.name}>{a.name}</span>
                            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0" onClick={() => setEditingEntity({ type: "adset", id: a.id, name: a.name, status: a.status, dailyBudget: a.daily_budget })} title="Editar conjunto na Meta Ads">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell style={adsetCellW("campaign")} className="text-muted-foreground text-sm truncate" title={a.campaignName}>{a.campaignName}</TableCell>
                        <TableCell style={adsetCellW("budget")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.daily_budget ?? 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("spend")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.spend} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("leads")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("cpl")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads > 0 ? a.spend / a.leads : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("clicks")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.clicks} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("impressions")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions} decimals={0} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* Ads Tab */}
          <TabsContent value="ads" className="m-0">
            <Card className="overflow-hidden rounded-none border-0 shadow-none">
              <div className="growdash-scrollbar overflow-x-auto">
                <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                  <TableHeader>
                    <TableRow className="h-11 bg-[#f3f0ea] hover:bg-[#f3f0ea]">
                      <ResizableHead colKey="name" width={ad.colWidths.name} onResize={ad.startResize("name")}>Anúncio</ResizableHead>
                      <ResizableHead colKey="adset" width={ad.colWidths.adset} onResize={ad.startResize("adset")}>Conjunto</ResizableHead>
                      <ResizableHead colKey="campaign" width={ad.colWidths.campaign} onResize={ad.startResize("campaign")}>Campanha</ResizableHead>
                      <ResizableHead colKey="spend" width={ad.colWidths.spend} onResize={ad.startResize("spend")} align="right">Gastos</ResizableHead>
                      <ResizableHead colKey="leads" width={ad.colWidths.leads} onResize={ad.startResize("leads")} align="right">Leads</ResizableHead>
                      <ResizableHead colKey="cpl" width={ad.colWidths.cpl} onResize={ad.startResize("cpl")} align="right">CPL</ResizableHead>
                      <ResizableHead colKey="clicks" width={ad.colWidths.clicks} onResize={ad.startResize("clicks")} align="right">Cliques</ResizableHead>
                      <ResizableHead colKey="ctr" width={ad.colWidths.ctr} onResize={ad.startResize("ctr")} align="right">CTR</ResizableHead>
                      <ResizableHead colKey="impressions" width={ad.colWidths.impressions} onResize={ad.startResize("impressions")} align="right">Impressões</ResizableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAds.map((a: any) => (
                      <TableRow key={a.id} className="h-12 odd:bg-white even:bg-[#fbfaf8] hover:bg-[#fff9e8]">
                        <TableCell style={adCellW("name")} className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.thumbnail_url ? (
                              <img src={a.thumbnail_url} alt="" className="h-8 w-8 rounded object-cover border flex-shrink-0" loading="lazy" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted border flex-shrink-0" />
                            )}
                            <StatusDot status={a.status} />
                            <span className="truncate" title={a.name}>{a.name}</span>
                            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0" onClick={() => setEditingEntity({ type: "ad", id: a.id, name: a.name, status: a.status })} title="Editar anúncio na Meta Ads">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell style={adCellW("adset")} className="text-muted-foreground text-sm truncate" title={a.adsetName}>{a.adsetName}</TableCell>
                        <TableCell style={adCellW("campaign")} className="text-muted-foreground text-sm truncate" title={a.campaignName}>{a.campaignName}</TableCell>
                        <TableCell style={adCellW("spend")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.spend} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adCellW("leads")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads} decimals={0} /></TableCell>
                        <TableCell style={adCellW("cpl")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads > 0 ? a.spend / a.leads : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adCellW("clicks")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.clicks} decimals={0} /></TableCell>
                        <TableCell style={adCellW("ctr")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0} suffix="%" decimals={2} /></TableCell>
                        <TableCell style={adCellW("impressions")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions} decimals={0} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </MotionItem>

      <CampaignDetailSheet
        open={!!detailCampaignId}
        onOpenChange={(v) => !v && setDetailCampaignId(null)}
        campaign={detailCampaignId ? (campaigns.find((c: any) => c.id === detailCampaignId) || null) : null}
      />
      <MetaEntityEditor
        entity={editingEntity}
        onOpenChange={(open) => !open && setEditingEntity(null)}
        onSaved={async () => { await refetch(); }}
      />
    </MotionPage>
  );
}
