import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { addDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useSales } from "@/hooks/useSales";
import { saleMatchesCampaign } from "@/lib/saleRevenue";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { DateFilterBar } from "@/components/dashboard/DateFilterBar";
import { AccountMultiSelect } from "@/components/dashboard/AccountMultiSelect";
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
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BrainCircuit,
  Plus,
  Copy as CopyIcon,
  MoreHorizontal,
  Send,
  FolderOpen,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CampaignDetailSheet } from "@/components/campaigns/CampaignDetailSheet";
import { EditableMetaEntity, MetaEntityEditor } from "@/components/campaigns/MetaEntityEditor";
import { MetaCampaignCreator } from "@/components/campaigns/MetaCampaignCreator";
import { MetaCampaignDuplicator } from "@/components/campaigns/MetaCampaignDuplicator";
import { ResizableHead, StatusDot, normalizeStatus, useColWidths } from "@/components/dashboard/ResizableTableHelpers";
import { cn } from "@/lib/utils";
import { getStatusBadge } from "@/lib/status";
import { MetaTableControls } from "@/components/campaigns/MetaTableControls";
import { getBreakdownLabel, getBreakdownStorageType, getMetaColumnPreset, type CampaignColumnKey, type MetaColumnPresetKey } from "@/lib/metaTableConfig";
import { TrafficAIAnalysis } from "@/components/campaigns/TrafficAIAnalysis";
import { MetaEntityDetailSheet, type MetaDetailEntity } from "@/components/campaigns/MetaEntityDetailSheet";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { pruneCampaignSelection, scopeCampaignHierarchy } from "@/lib/metaHierarchy";
import { getCampaignActiveDays, getCampaignHealth, type CampaignHealth } from "@/lib/campaignHealth";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { resolveMetaActionMetrics } from "@/lib/metaActionMetrics";
import { friendlyActionLabel } from "@/hooks/useCustomMetrics";
import { resolveCampaignPrimaryResult, resolveCampaignResults } from "@/lib/campaignResultEvents";

type CampSortKey = "status" | "name" | "objective" | "budget" | "salesCount" | "cpa" | "spend" | "leads" | "profit" | "roi" | "roas" | "revenue" | "cpl" | "ctr" | "cpc" | "cpm" | "conversionRate" | "clicks" | "impressions" | "reach" | "frequency" | "linkClicks" | "linkCpc" | "uniqueLinkCtr" | "landingPageViews" | "costPerLandingPageView" | "checkouts" | "costPerCheckout" | "metaPurchases" | "metaCostPerPurchase" | "metaPurchaseRoas";
type CampColKey = CampaignColumnKey;
type AdsetColKey = "name" | "campaign" | "budget" | "spend" | "leads" | "cpl" | "clicks" | "ctr" | "cpc" | "impressions" | "reach" | "frequency" | "cpm" | "sales" | "revenue";
type AdColKey = "name" | "adset" | "campaign" | "spend" | "leads" | "cpl" | "clicks" | "ctr" | "cpc" | "impressions" | "reach" | "frequency" | "cpm" | "sales" | "revenue";
const HEALTH_OPTIONS: Array<{ id: CampaignHealth; label: string; dot: string; active: string }> = [
  { id: "critical", label: "Crítico", dot: "bg-red-500", active: "border-red-500/55 bg-red-500/10 text-red-500" },
  { id: "warning", label: "Atenção", dot: "bg-amber-400", active: "border-amber-400/55 bg-amber-400/10 text-amber-500" },
  { id: "observation", label: "Observação", dot: "bg-orange-500", active: "border-orange-500/55 bg-orange-500/10 text-orange-500" },
  { id: "initial", label: "Estado inicial", dot: "bg-blue-500", active: "border-blue-500/55 bg-blue-500/10 text-blue-500" },
  { id: "healthy", label: "Saudável", dot: "bg-emerald-500", active: "border-emerald-500/55 bg-emerald-500/10 text-emerald-500" },
  { id: "inactive", label: "Inativas", dot: "bg-zinc-400", active: "border-zinc-400/55 bg-zinc-400/10 text-zinc-500" },
];

const CAMPAIGN_COLUMN_FILTERS: Array<{ key: string; label: string; column?: CampaignColumnKey }> = [
  { key: "status", label: "Status" }, { key: "name", label: "Campanha" },
  { key: "deliveryStatus", label: "Veiculação", column: "deliveryStatus" }, { key: "objective", label: "Objetivo", column: "objective" },
  { key: "budget", label: "Orçamento", column: "budget" }, { key: "spend", label: "Valor usado", column: "spend" },
  { key: "impressions", label: "Impressões", column: "impressions" }, { key: "reach", label: "Alcance", column: "reach" },
  { key: "frequency", label: "Frequência", column: "frequency" }, { key: "cpm", label: "CPM", column: "cpm" },
  { key: "clicks", label: "Cliques", column: "clicks" }, { key: "linkClicks", label: "Cliques no link", column: "linkClicks" },
  { key: "cpc", label: "CPC", column: "cpc" }, { key: "linkCpc", label: "CPC do link", column: "linkCpc" },
  { key: "ctr", label: "CTR", column: "ctr" }, { key: "uniqueLinkCtr", label: "CTR único", column: "uniqueLinkCtr" },
  { key: "leads", label: "Resultados", column: "leads" }, { key: "cpl", label: "Custo por resultado", column: "cpl" },
  { key: "conversionRate", label: "Taxa de resultado", column: "conversion" }, { key: "salesCount", label: "Vendas", column: "sales" },
  { key: "cpa", label: "CPA", column: "cpa" }, { key: "revenue", label: "Receita", column: "revenue" },
  { key: "roas", label: "ROAS", column: "roas" }, { key: "profit", label: "Lucro", column: "profit" },
  { key: "roi", label: "ROI", column: "roi" }, { key: "landingPageViews", label: "Visualizações da página", column: "landingPageViews" },
  { key: "checkouts", label: "Finalizações iniciadas", column: "checkouts" }, { key: "metaPurchases", label: "Compras", column: "metaPurchases" },
  { key: "metaPurchaseRoas", label: "ROAS de compras", column: "metaPurchaseRoas" },
];

function campaignColumnValue(campaign: any, key: string) {
  if (key === "status" || key === "deliveryStatus") return `${getStatusBadge(campaign.status).label} ${campaign.status || ""}`;
  if (key === "leads") return String(campaign.primaryResult ?? campaign.results?.total ?? campaign.leads ?? 0);
  if (key === "cpl") return String(campaign.costPerResult ?? campaign.cpl ?? 0);
  return String(campaign[key] ?? "");
}

function campaignPrimaryResult(campaign: any) {
  return resolveCampaignPrimaryResult(campaign.objective, {
    leadCount: Math.max(0, Number((campaign.results?.leadCount ?? campaign.leads) || 0)),
    conversations: Math.max(0, Number(campaign.results?.conversations || 0)),
  });
}

function formatApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstRelation(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function aggregateInsights(ads: any[], startDate?: Date, endDate?: Date) {
  const start = startDate ? formatApiDate(startDate) : null;
  const end = endDate ? formatApiDate(endDate) : null;
  const totals = { spend: 0, leads: 0, clicks: 0, impressions: 0, reach: 0 };

  for (const ad of ads || []) {
    for (const insight of ad.insights || []) {
      if (start && insight.date < start) continue;
      if (end && insight.date > end) continue;
      totals.spend += insight.spend ?? 0;
      totals.leads += insight.leads ?? 0;
      totals.clicks += insight.clicks ?? 0;
      totals.impressions += insight.impressions ?? 0;
      totals.reach += insight.reach ?? 0;
    }
  }

  return totals;
}

async function fetchAllPages(query: any, pageSize = 1000, maxPages = 20) {
  const rows: any[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

const CAMP_DEFAULTS: Record<CampColKey, number> = {
  check: 40, name: 390, delivery: 105, objective: 120, budget: 120, spend: 110, impressions: 95,
  reach: 100, frequency: 90, cpm: 80, clicks: 88, ctr: 85, cpc: 96, leads: 135, cpl: 118,
  conversion: 110, sales: 95, cpa: 110, revenue: 125, roas: 90, profit: 120, roi: 90,
  deliveryStatus: 125, linkClicks: 120, linkCpc: 150, uniqueLinkCtr: 160,
  landingPageViews: 175, costPerLandingPageView: 190, checkouts: 175, costPerCheckout: 190,
  metaPurchases: 100, metaCostPerPurchase: 140, metaPurchaseRoas: 100,
  videoViews: 130, actions: 90,
};
// Evita que uma largura salva muito pequena faça os títulos se sobreporem.
// Cada coluna ainda pode ser ampliada livremente pelo usuário.
const CAMP_MIN_WIDTHS: Record<CampColKey, number> = {
  check: 40, delivery: 92, name: 250, deliveryStatus: 110, actions: 82,
  objective: 105, budget: 105, spend: 105, impressions: 90, reach: 90,
  frequency: 82, cpm: 76, clicks: 78, linkClicks: 108, linkCpc: 132,
  uniqueLinkCtr: 140, cpc: 86, ctr: 80, leads: 122, cpl: 112,
  conversion: 105, sales: 84, cpa: 98, revenue: 112, roas: 80,
  profit: 108, roi: 78, landingPageViews: 160, costPerLandingPageView: 178,
  checkouts: 160, costPerCheckout: 178, metaPurchases: 94,
  metaCostPerPurchase: 128, metaPurchaseRoas: 94, videoViews: 120,
};
const ADSET_DEFAULTS: Record<AdsetColKey, number> = {
  name: 260, campaign: 220, budget: 130, spend: 120, leads: 90, cpl: 110, clicks: 100, ctr: 90,
  cpc: 100, impressions: 120, reach: 110, frequency: 100, cpm: 110, sales: 90, revenue: 120,
};
const AD_DEFAULTS: Record<AdColKey, number> = {
  name: 260, adset: 200, campaign: 200, spend: 120, leads: 90, cpl: 110, clicks: 100, ctr: 100,
  cpc: 100, impressions: 120, reach: 110, frequency: 100, cpm: 110, sales: 90, revenue: 120,
};

function levelMetricValue(entity: any, key: AdsetColKey | AdColKey) {
  if (key === "name") return String(entity.name || "").toLocaleLowerCase("pt-BR");
  if (key === "campaign") return String(entity.campaignName || "").toLocaleLowerCase("pt-BR");
  if (key === "adset") return String(entity.adsetName || "").toLocaleLowerCase("pt-BR");
  if (key === "budget") return Number(entity.daily_budget || 0);
  if (key === "cpl") return entity.leads > 0 ? entity.spend / entity.leads : 0;
  if (key === "ctr") return entity.impressions > 0 ? entity.clicks / entity.impressions * 100 : 0;
  if (key === "cpc") return entity.clicks > 0 ? entity.spend / entity.clicks : 0;
  if (key === "frequency") return entity.reach > 0 ? entity.impressions / entity.reach : 0;
  if (key === "cpm") return entity.impressions > 0 ? entity.spend / entity.impressions * 1000 : 0;
  return Number(entity[key] || 0);
}

function sortLevelRows<T>(rows: T[], key: AdsetColKey | AdColKey, ascending: boolean) {
  return [...rows].sort((left: any, right: any) => {
    const a = levelMetricValue(left, key);
    const b = levelMetricValue(right, key);
    const comparison = typeof a === "string" && typeof b === "string" ? a.localeCompare(b, "pt-BR") : Number(a) - Number(b);
    return ascending ? comparison : -comparison;
  });
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const syncMeta = useSyncMeta();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [columnFiltersOpen, setColumnFiltersOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [detailEntity, setDetailEntity] = useState<MetaDetailEntity | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableMetaEntity | null>(null);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [duplicatingCampaign, setDuplicatingCampaign] = useState<{ id: string; name: string; status?: string | null } | null>(null);
  const [sortKey, setSortKey] = useState<CampSortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [adsetSortKey, setAdsetSortKey] = useState<AdsetColKey>("spend");
  const [adsetSortAsc, setAdsetSortAsc] = useState(false);
  const [adSortKey, setAdSortKey] = useState<AdColKey>("spend");
  const [adSortAsc, setAdSortAsc] = useState(false);
  const [statusSortCycle, setStatusSortCycle] = useState<0 | 1 | 2>(0);
  const [columnPreset, setColumnPreset] = useState<MetaColumnPresetKey>("performance");
  const [visibleColumns, setVisibleColumns] = useState<Set<CampaignColumnKey>>(() => {
    try { const saved = JSON.parse(localStorage.getItem("growdash:meta-columns-v2") || "[]"); if (Array.isArray(saved) && saved.length) return new Set(saved); } catch { /* usa o preset padrão */ }
    return new Set(getMetaColumnPreset("performance").columns);
  });
  const [breakdown, setBreakdown] = useState(() => localStorage.getItem("growdash:meta-breakdown") || "none");
  const [campaignPage, setCampaignPage] = useState(0);
  const campaignTableScrollRef = useRef<HTMLDivElement | null>(null);
  const campaignTotalsScrollRef = useRef<HTMLDivElement | null>(null);
  const [campaignTotalsViewport, setCampaignTotalsViewport] = useState<{ left: number; top: number; width: number } | null>(null);
  const [healthFilter, setHealthFilter] = useState<CampaignHealth | "all">("all");
  const [analysisPanel, setAnalysisPanel] = useState<"alerts" | "intelligence" | null>(() => {
    const requested = searchParams.get("analise");
    return requested === "alerts" || requested === "intelligence" ? requested : null;
  });
  const analysisMode = analysisPanel !== null;
  // A paginação só existe no gerenciador compacto. Quando uma análise está
  // aberta, todas as campanhas permanecem disponíveis em uma única lista e o
  // próprio bloco da tabela assume o scroll vertical.
  const pageSize = 50;

  useEffect(() => {
    localStorage.setItem("growdash:meta-columns-v2", JSON.stringify(Array.from(visibleColumns)));
    localStorage.setItem("growdash:meta-breakdown", breakdown);
  }, [visibleColumns, breakdown]);

  useEffect(() => {
    const requested = searchParams.get("analise");
    if (requested === "alerts" || requested === "intelligence") setAnalysisPanel(requested);
  }, [searchParams]);

  useEffect(() => {
    setCampaignPage(0);
  }, [analysisMode]);

  const updateAnalysisPanel = (next: "alerts" | "intelligence" | null) => {
    setAnalysisPanel(next);
    const updated = new URLSearchParams(searchParams);
    if (next) updated.set("analise", next);
    else updated.delete("analise");
    setSearchParams(updated, { replace: true });
  };

  const {
    preset,
    setPreset,
    customRange,
    setCustomRange,
    startDate,
    endDate,
    adAccountId: selectedAccount,
    setAdAccountId: setSelectedAccount,
    adAccountIds: selectedAccountIds,
    setAdAccountIds: setSelectedAccountIds,
    businessUnitId,
    segment,
  } = useGlobalFilters();
  const { data: adAccounts = [] } = useAdAccounts();
  const visibleAdAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, segment]);

  useEffect(() => {
    const requestedAccount = searchParams.get("conta");
    if (requestedAccount && requestedAccount !== selectedAccount && visibleAdAccounts.some((account) => account.id === requestedAccount)) {
      setSelectedAccount(requestedAccount);
    }
  }, [searchParams, selectedAccount, setSelectedAccount, visibleAdAccounts]);

  const { data: sales = [], dataUpdatedAt: salesUpdatedAt } = useSales({ startDate, endDate, adAccountId: selectedAccount === "all" ? undefined : selectedAccount, adAccountIds: selectedAccountIds });

  const salesForAd = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const sale of sales) {
      if (sale.status !== "confirmed") continue;
      const adId = sale.manual_override ? sale.manual_ad_id : sale.ad_id;
      if (!adId) continue;
      const current = map.get(adId) ?? { count: 0, revenue: 0 };
      current.count += Math.max(1, Number(sale.quantity || 1));
      current.revenue += Number(sale.net_revenue || 0);
      map.set(adId, current);
    }
    return map;
  }, [sales]);

  // v4 descarta preferências antigas que permitiam salvar larguras ilegíveis.
  const camp = useColWidths<CampColKey>(CAMP_DEFAULTS, "campaigns-cols-v4", CAMP_MIN_WIDTHS);
  const adset = useColWidths<AdsetColKey>(ADSET_DEFAULTS, "campaigns-adset-cols-v1");
  const ad = useColWidths<AdColKey>(AD_DEFAULTS, "campaigns-ad-cols-v1");

  const handleSort = (key: CampSortKey) => {
    if (key === "status") {
      if (sortKey !== "status" || statusSortCycle === 0) {
        setSortKey("status");
        setSortAsc(false);
        setStatusSortCycle(1);
      } else if (statusSortCycle === 1) {
        setSortAsc(true);
        setStatusSortCycle(2);
      } else {
        setSortKey("spend");
        setSortAsc(false);
        setStatusSortCycle(0);
      }
      return;
    }

    setStatusSortCycle(0);
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleAdsetSort = (key: AdsetColKey) => {
    if (adsetSortKey === key) setAdsetSortAsc((current) => !current);
    else { setAdsetSortKey(key); setAdsetSortAsc(false); }
  };

  const handleAdSort = (key: AdColKey) => {
    if (adSortKey === key) setAdSortAsc((current) => !current);
    else { setAdSortKey(key); setAdSortAsc(false); }
  };

  const { data: campaignBaseRows = [], isLoading, isFetching, isError, error: campaignError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["campaigns_full", selectedAccount, visibleAdAccounts.map((account) => account.id).join(","), startDate?.toISOString(), endDate?.toISOString(), salesUpdatedAt],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select(`
          id, name, ad_account_id, status, objective, daily_budget, lifetime_budget, created_at,
          adsets(
            id, name, daily_budget, status,
            ads(
              id, name, thumbnail_url, status,
              insights(spend, leads, clicks, inline_link_clicks, unique_inline_link_clicks, impressions, reach, ctr, cpm, cpl, frequency, conversion_rate, health_score, date)
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (selectedAccount !== "all") {
        query = query.eq("ad_account_id", selectedAccount);
      } else {
        const visibleIds = visibleAdAccounts.map((account) => account.id);
        query = query.in("ad_account_id", visibleIds.length ? visibleIds : ["00000000-0000-0000-0000-000000000000"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((c: any) => {
        let spend = 0, leads = 0, clicks = 0, linkClicks = 0, uniqueLinkClicks = 0, impressions = 0, reach = 0;
        const adsets = c.adsets || [];
        let adsetBudget = 0;

        for (const adset of adsets) {
          adsetBudget += adset.daily_budget ?? 0;
          for (const ad of adset.ads || []) {
            for (const i of ad.insights || []) {
              if (startDate && i.date < format(startDate, "yyyy-MM-dd")) continue;
              if (endDate && i.date > format(endDate, "yyyy-MM-dd")) continue;
              spend += i.spend ?? 0;
              leads += i.leads ?? 0;
              clicks += i.clicks ?? 0;
              linkClicks += i.inline_link_clicks ?? 0;
              uniqueLinkClicks += i.unique_inline_link_clicks ?? 0;
              impressions += i.impressions ?? 0;
              reach += i.reach ?? 0;
            }
          }
        }

        const campaignSales = sales.filter((sale) => saleMatchesCampaign(sale, {
          id: c.id,
          name: c.name,
          ad_account_id: c.ad_account_id,
        }));
        const salesCount = campaignSales.reduce((sum, sale) => sum + Math.max(1, Number(sale.quantity || 1)), 0);
        const revenue = campaignSales.reduce((sum, s) => sum + (s.net_revenue ?? 0), 0);
        const profit = revenue - spend;
        const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
        const cpa = salesCount > 0 ? spend / salesCount : 0;
        const cpl = leads > 0 ? spend / leads : 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const frequency = reach > 0 ? impressions / reach : 0;
        const conversionRate = clicks > 0 ? (leads / clicks) * 100 : 0;
        const roas = spend > 0 ? revenue / spend : 0;

        const linkCpc = linkClicks > 0 ? spend / linkClicks : 0;
        const uniqueLinkCtr = reach > 0 ? uniqueLinkClicks / reach * 100 : 0;

        const budget = Number(c.daily_budget || 0) > 0 ? Number(c.daily_budget) : adsetBudget;
        return { ...c, adsets, budget, spend, leads, clicks, linkClicks, uniqueLinkClicks, linkCpc, uniqueLinkCtr, impressions, reach, frequency, salesCount, revenue, profit, roi, roas, cpa, cpl, ctr, cpc, cpm, conversionRate };
      });
    },
  });

  const campaignAdIds = useMemo(() => campaignBaseRows.flatMap((campaign: any) =>
    (campaign.adsets || []).flatMap((currentAdset: any) => (currentAdset.ads || []).map((currentAd: any) => currentAd.id))), [campaignBaseRows]);
  const { data: actionData } = useActionTotalsByAds(campaignAdIds, startDate, endDate);
  const campaigns = useMemo(() => campaignBaseRows.map((campaign: any) => {
    const actionMetrics = { linkClicks: 0, landingPageViews: 0, checkouts: 0, purchases: 0, purchaseValue: 0 };
    const actionEventTotals: Record<string, number> = {};
    for (const currentAdset of campaign.adsets || []) {
      for (const currentAd of currentAdset.ads || []) {
        const resolved = resolveMetaActionMetrics(actionData?.totalsByAd[currentAd.id], actionData?.valueTotalsByAd[currentAd.id]);
        actionMetrics.linkClicks += resolved.linkClicks;
        actionMetrics.landingPageViews += resolved.landingPageViews;
        actionMetrics.checkouts += resolved.checkouts;
        actionMetrics.purchases += resolved.purchases;
        actionMetrics.purchaseValue += resolved.purchaseValue;
        for (const [actionType, value] of Object.entries(actionData?.totalsByAd[currentAd.id] || {})) {
          actionEventTotals[actionType] = (actionEventTotals[actionType] || 0) + Number(value || 0);
        }
      }
    }

    const linkClicks = campaign.linkClicks > 0 ? campaign.linkClicks : actionMetrics.linkClicks;
    const results = resolveCampaignResults(campaign.leads, actionEventTotals);
    const primaryResult = resolveCampaignPrimaryResult(campaign.objective, results).value;
    return {
      ...campaign,
      // Todas as métricas de aquisição usam a mesma definição operacional de
      // lead: formulário/site + conversa iniciada. O resultado exibido na
      // linha segue o objetivo da campanha e é calculado em `primaryResult`.
      leads: results.total,
      cpl: results.total > 0 ? campaign.spend / results.total : 0,
      conversionRate: campaign.clicks > 0 ? results.total / campaign.clicks * 100 : 0,
      linkClicks,
      linkCpc: linkClicks > 0 ? campaign.spend / linkClicks : 0,
      landingPageViews: actionMetrics.landingPageViews,
      costPerLandingPageView: actionMetrics.landingPageViews > 0 ? campaign.spend / actionMetrics.landingPageViews : 0,
      checkouts: actionMetrics.checkouts,
      costPerCheckout: actionMetrics.checkouts > 0 ? campaign.spend / actionMetrics.checkouts : 0,
      metaPurchases: actionMetrics.purchases,
      metaCostPerPurchase: actionMetrics.purchases > 0 ? campaign.spend / actionMetrics.purchases : 0,
      metaPurchaseRoas: campaign.spend > 0 ? actionMetrics.purchaseValue / campaign.spend : 0,
      actionEvents: Object.entries(actionEventTotals).map(([actionType, value]) => ({ actionType, value })).sort((a, b) => b.value - a.value),
      results,
      // Para campanhas de mensagem, conversa iniciada é o resultado mostrado
      // e a base do custo. Leads e os demais eventos ficam no detalhamento.
      primaryResult,
      costPerResult: primaryResult > 0 ? campaign.spend / primaryResult : 0,
    };
  }), [actionData?.totalsByAd, actionData?.valueTotalsByAd, campaignBaseRows]);

  // Conjuntos e anúncios são carregados por consultas próprias. Assim, abrir
  // esses níveis nunca depende de marcar uma campanha nem do embed da tabela
  // de campanhas. A seleção serve exclusivamente como filtro descendente.
  const { data: accountAdsets = [], isLoading: isLoadingAdsets } = useQuery({
    queryKey: ["meta-adsets-independent", selectedAccount, visibleAdAccounts.map((account) => account.id).join(",")],
    queryFn: async () => {
      let query = supabase
        .from("adsets")
        .select("id,name,daily_budget,status,campaign_id,campaigns!inner(id,name,ad_account_id)")
        .order("name", { ascending: true });
      if (selectedAccount !== "all") query = query.eq("campaigns.ad_account_id", selectedAccount);
      else {
        const accountIds = visibleAdAccounts.map((account) => account.id);
        query = query.in("campaigns.ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
      }
      return fetchAllPages(query);
    },
  });

  const { data: accountAds = [], isLoading: isLoadingAds } = useQuery({
    queryKey: ["meta-ads-independent", selectedAccount, visibleAdAccounts.map((account) => account.id).join(",")],
    queryFn: async () => {
      let query = supabase
        .from("ads")
        .select("id,name,thumbnail_url,status,adset_id,adsets!inner(id,name,campaign_id,campaigns!inner(id,name,objective,ad_account_id))")
        .order("name", { ascending: true });
      if (selectedAccount !== "all") query = query.eq("adsets.campaigns.ad_account_id", selectedAccount);
      else {
        const accountIds = visibleAdAccounts.map((account) => account.id);
        query = query.in("adsets.campaigns.ad_account_id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
      }
      return fetchAllPages(query);
    },
  });

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedAccount]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = pruneCampaignSelection(current, campaigns);
      if (next.size === current.size && Array.from(next).every((id) => current.has(id))) return current;
      return next;
    });
  }, [campaigns]);

  const handleSync = async () => {
    if (visibleAdAccounts.length === 0) {
      toast({ title: "Conecte uma conta Meta Ads", description: "Abra Integrações → Tráfego pago para conectar a primeira conta." });
      navigate("/integracoes");
      return;
    }
    try {
      await syncMeta.mutateAsync({
        adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
        adAccountIds: selectedAccount === "all" ? visibleAdAccounts.map((account) => account.id) : undefined,
        startDate: formatApiDate(startDate),
        endDate: formatApiDate(endDate),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns_full"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-adsets-independent"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-ads-independent"] }),
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
        queryClient.invalidateQueries({ queryKey: ["ad_accounts"] }),
      ]);
    } catch {
      // useSyncMeta already shows the actionable Meta/HTTP error.
    }
  };

  useEffect(() => {
    if (!isError) return;
    toast({ title: "Erro ao carregar campanhas", description: campaignError instanceof Error ? campaignError.message : "Tente novamente.", variant: "destructive" });
  }, [campaignError, isError, toast]);

  const campaignIds = useMemo(() => campaigns.map((campaign: any) => campaign.id), [campaigns]);
  const { data: campaignTargets = [] } = useQuery({
    queryKey: ["campaign-targets-overview", campaignIds.join(",")],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_targets").select("campaign_id,target_cpl").in("campaign_id", campaignIds);
      if (error) throw error;
      return data || [];
    },
  });
  const targetByCampaign = useMemo(() => new Map(campaignTargets.map((target) => [target.campaign_id, Number(target.target_cpl || 0)])), [campaignTargets]);

  const averageCpl = useMemo(() => {
    const withLeads = campaigns.filter((campaign: any) => campaign.leads > 0 && campaign.spend > 0);
    const spend = withLeads.reduce((sum: number, campaign: any) => sum + campaign.spend, 0);
    const leads = withLeads.reduce((sum: number, campaign: any) => sum + campaign.leads, 0);
    return leads > 0 ? spend / leads : 0;
  }, [campaigns]);

  const healthCounts = useMemo(() => campaigns.reduce((counts: Record<CampaignHealth, number>, campaign: any) => {
    counts[getCampaignHealth(campaign, averageCpl, targetByCampaign.get(campaign.id))] += 1;
    return counts;
  }, { critical: 0, warning: 0, observation: 0, initial: 0, healthy: 0, inactive: 0 }), [averageCpl, campaigns, targetByCampaign]);

  const filtered = useMemo(() => {
    let result = campaigns;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) => [c.name, c.id, c.objective, c.status, c.spend, c.primaryResult ?? c.results?.total ?? c.leads, c.costPerResult ?? c.cpl, c.ctr, c.roas]
        .some((value) => String(value ?? "").toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") {
      result = result.filter((c: any) => normalizeStatus(c.status) === statusFilter);
    }
    if (healthFilter !== "all") {
      result = result.filter((c: any) => getCampaignHealth(c, averageCpl, targetByCampaign.get(c.id)) === healthFilter);
    }
    for (const [key, rawValue] of Object.entries(columnFilters)) {
      const value = rawValue.trim().toLocaleLowerCase("pt-BR");
      if (!value) continue;
      result = result.filter((campaign: any) => campaignColumnValue(campaign, key).toLocaleLowerCase("pt-BR").includes(value));
    }
    result = [...result].sort((a: any, b: any) => {
      if (sortKey === "status") {
        const activeA = normalizeStatus(a.status) === "ACTIVE" ? 1 : 0;
        const activeB = normalizeStatus(b.status) === "ACTIVE" ? 1 : 0;
        const difference = activeA - activeB;

        // Primeiro clique: ativas no topo. Segundo clique: ativas no fim.
        return sortAsc ? difference : -difference;
      }

      const av = sortKey === "leads" ? (a.primaryResult ?? a.results?.total ?? a.leads) : sortKey === "cpl" ? (a.costPerResult ?? a.cpl) : a[sortKey];
      const bv = sortKey === "leads" ? (b.primaryResult ?? b.results?.total ?? b.leads) : sortKey === "cpl" ? (b.costPerResult ?? b.cpl) : b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return result;
  }, [averageCpl, campaigns, columnFilters, healthFilter, search, statusFilter, sortKey, sortAsc, targetByCampaign]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleCampaigns = useMemo(
    () => analysisMode ? filtered : filtered.slice(campaignPage * pageSize, (campaignPage + 1) * pageSize),
    [analysisMode, campaignPage, filtered],
  );
  const storageBreakdownType = getBreakdownStorageType(breakdown);
  const breakdownCampaignIds = useMemo(() => filtered.map((campaign: any) => String(campaign.id)).filter(Boolean), [filtered]);
  const breakdownQuery = useQuery({
    queryKey: ["campaign-breakdown-workspace", storageBreakdownType, breakdownCampaignIds.join(","), formatApiDate(startDate), formatApiDate(endDate)],
    enabled: !!storageBreakdownType && breakdownCampaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("insights_breakdowns").select("segment_key,spend,impressions,clicks,leads,date").eq("breakdown_type", storageBreakdownType).in("campaign_id", breakdownCampaignIds).gte("date", formatApiDate(startDate)).lte("date", formatApiDate(endDate));
      if (error) throw error;
      return data ?? [];
    },
  });
  const breakdownSegments = useMemo(() => {
    const grouped = new Map<string, { key: string; spend: number; impressions: number; clicks: number; leads: number }>();
    for (const row of breakdownQuery.data ?? []) {
      const key = String(row.segment_key || "Não informado");
      const current = grouped.get(key) ?? { key, spend: 0, impressions: 0, clicks: 0, leads: 0 };
      current.spend += Number(row.spend || 0); current.impressions += Number(row.impressions || 0); current.clicks += Number(row.clicks || 0); current.leads += Number(row.leads || 0);
      grouped.set(key, current);
    }
    return [...grouped.values()].map((row) => ({ ...row, ctr: row.impressions ? row.clicks / row.impressions * 100 : 0, cpl: row.leads ? row.spend / row.leads : 0 })).sort((a, b) => b.spend - a.spend);
  }, [breakdownQuery.data]);
  const requestBreakdownSync = () => syncMeta.mutate({
    adAccountId: selectedAccount === "all" ? undefined : selectedAccount,
    adAccountIds: selectedAccount === "all" ? visibleAdAccounts.map((account) => account.id) : undefined,
    startDate: formatApiDate(startDate), endDate: formatApiDate(endDate), includeBreakdowns: true,
  });
  useEffect(() => { setCampaignPage(0); }, [search, statusFilter, healthFilter, columnFilters, selectedAccount, startDate, endDate, sortKey, sortAsc]);
  useEffect(() => { if (campaignPage >= pageCount) setCampaignPage(pageCount - 1); }, [campaignPage, pageCount]);

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
      budget: acc.budget + c.budget,
      spend: acc.spend + c.spend,
      // Lead de aquisição inclui formulário/site e conversas iniciadas. A tabela
      // continua mostrando o resultado principal de cada campanha individual.
      leads: acc.leads + (c.results?.total ?? c.leads),
      formLeads: acc.formLeads + (c.results?.leadCount ?? c.leads),
      conversations: acc.conversations + (c.results?.conversations ?? 0),
      results: acc.results + (c.results?.total ?? c.primaryResult ?? c.leads),
      salesCount: acc.salesCount + c.salesCount, revenue: acc.revenue + c.revenue,
      profit: acc.profit + c.profit, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
      reach: acc.reach + c.reach, linkClicks: acc.linkClicks + c.linkClicks,
      uniqueLinkClicks: acc.uniqueLinkClicks + c.uniqueLinkClicks,
      landingPageViews: acc.landingPageViews + c.landingPageViews,
      checkouts: acc.checkouts + c.checkouts, metaPurchases: acc.metaPurchases + c.metaPurchases,
      metaPurchaseValue: acc.metaPurchaseValue + (c.metaPurchaseRoas * c.spend),
    }),
    { budget: 0, spend: 0, leads: 0, formLeads: 0, conversations: 0, results: 0, salesCount: 0, revenue: 0, profit: 0, impressions: 0, clicks: 0, reach: 0, linkClicks: 0, uniqueLinkClicks: 0, landingPageViews: 0, checkouts: 0, metaPurchases: 0, metaPurchaseValue: 0 }
  ), [filtered]);
  const totalCtr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : 0;
  const totalCpl = totals.results > 0 ? totals.spend / totals.results : 0;
  const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const totalLinkCpc = totals.linkClicks > 0 ? totals.spend / totals.linkClicks : 0;
  const totalUniqueLinkCtr = totals.reach > 0 ? totals.uniqueLinkClicks / totals.reach * 100 : 0;
  const totalCostPerLandingPageView = totals.landingPageViews > 0 ? totals.spend / totals.landingPageViews : 0;
  const totalCostPerCheckout = totals.checkouts > 0 ? totals.spend / totals.checkouts : 0;
  const totalMetaCostPerPurchase = totals.metaPurchases > 0 ? totals.spend / totals.metaPurchases : 0;
  const totalMetaPurchaseRoas = totals.spend > 0 ? totals.metaPurchaseValue / totals.spend : 0;
  const totalResultRate = totals.clicks > 0 ? totals.results / totals.clicks * 100 : 0;
  const intelligenceSeries = useMemo(() => {
    const byDate = new Map<string, { date: string; spend: number; impressions: number; clicks: number; leads: number; hasData: boolean }>();
    const lastDate = formatApiDate(endDate);
    for (let cursor = startDate; formatApiDate(cursor) <= lastDate; cursor = addDays(cursor, 1)) {
      const date = formatApiDate(cursor);
      byDate.set(date, { date, spend: 0, impressions: 0, clicks: 0, leads: 0, hasData: false });
    }
    for (const campaign of filtered) {
      for (const currentAdset of campaign.adsets || []) {
        for (const currentAd of currentAdset.ads || []) {
          const insightsByDate = new Map<string, any>();
          for (const insight of currentAd.insights || []) {
            if (!insight.date) continue;
            if (insight.date < formatApiDate(startDate) || insight.date > formatApiDate(endDate)) continue;
            insightsByDate.set(insight.date, insight);
            const current = byDate.get(insight.date) ?? { date: insight.date, spend: 0, impressions: 0, clicks: 0, leads: 0, hasData: false };
            current.spend += Number(insight.spend || 0);
            current.impressions += Number(insight.impressions || 0);
            current.clicks += Number(insight.clicks || 0);
            current.hasData = true;
            byDate.set(insight.date, current);
          }

          const actionDays = actionData?.dailyByAd?.[currentAd.id] || {};
          const dates = new Set([...insightsByDate.keys(), ...Object.keys(actionDays)]);
          for (const date of dates) {
            const insight = insightsByDate.get(date);
            const current = byDate.get(date) ?? { date, spend: 0, impressions: 0, clicks: 0, leads: 0, hasData: false };
            const dailyResults = resolveCampaignResults(Number(insight?.leads || 0), actionDays[date] || {});
            current.leads += dailyResults.total;
            current.hasData = true;
            byDate.set(date, current);
          }
        }
      }
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({
      ...item,
      label: new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ctr: item.impressions > 0 ? item.clicks / item.impressions * 100 : 0,
      cpc: item.clicks > 0 ? item.spend / item.clicks : 0,
      cpm: item.impressions > 0 ? item.spend / item.impressions * 1000 : 0,
      cpl: item.leads > 0 ? item.spend / item.leads : 0,
      resultRate: item.clicks > 0 ? item.leads / item.clicks * 100 : 0,
    }));
  }, [actionData?.dailyByAd, endDate, filtered, startDate]);

  const selectedCampaign = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = Array.from(selectedIds)[0];
    return campaigns.find((campaign: any) => campaign.id === id) ?? null;
  }, [campaigns, selectedIds]);

  const levelCampaigns = useMemo(() => {
    let scope = campaigns;
    if (healthFilter !== "all") scope = scope.filter((campaign: any) => getCampaignHealth(campaign, averageCpl, targetByCampaign.get(campaign.id)) === healthFilter);
    return scopeCampaignHierarchy(scope, selectedIds);
  }, [averageCpl, campaigns, healthFilter, selectedIds, targetByCampaign]);

  const embeddedAdsetsById = useMemo(() => {
    const byId = new Map<string, any>();
    for (const campaign of campaigns) {
      for (const currentAdset of campaign.adsets || []) byId.set(currentAdset.id, currentAdset);
    }
    return byId;
  }, [campaigns]);

  const embeddedAdsById = useMemo(() => {
    const byId = new Map<string, any>();
    for (const campaign of campaigns) {
      for (const currentAdset of campaign.adsets || []) {
        for (const currentAd of currentAdset.ads || []) byId.set(currentAd.id, currentAd);
      }
    }
    return byId;
  }, [campaigns]);

  // Sem seleção, nenhum filtro de campanha é aplicado: todos os descendentes
  // da(s) conta(s) ativa(s) ficam visíveis. A seleção e o filtro de saúde são
  // apenas refinamentos opcionais da lista já carregada diretamente do banco.
  const descendantCampaignIds = useMemo(() => {
    if (selectedIds.size > 0) return selectedIds;
    if (healthFilter !== "all") return new Set(levelCampaigns.map((campaign: any) => campaign.id));
    return null;
  }, [healthFilter, levelCampaigns, selectedIds]);

  const selectedAdsets = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = accountAdsets
      .map((currentAdset: any) => {
        const campaign = firstRelation(currentAdset.campaigns);
        const embeddedAdset = embeddedAdsetsById.get(currentAdset.id);
        const metrics = aggregateInsights(embeddedAdset?.ads || [], startDate, endDate);
        const saleMetrics = (embeddedAdset?.ads || []).reduce((sum: { count: number; revenue: number }, currentAd: any) => {
          const value = salesForAd.get(currentAd.id);
          return { count: sum.count + (value?.count || 0), revenue: sum.revenue + (value?.revenue || 0) };
        }, { count: 0, revenue: 0 });
        return {
          ...currentAdset,
          ...metrics,
          campaignId: currentAdset.campaign_id,
          campaignName: campaign?.name || "Campanha sem nome",
          sales: saleMetrics.count,
          revenue: saleMetrics.revenue,
        };
      })
      .filter((currentAdset: any) => !descendantCampaignIds || descendantCampaignIds.has(currentAdset.campaignId))
      .filter((currentAdset: any) => statusFilter === "all" || normalizeStatus(currentAdset.status) === statusFilter)
      .filter((currentAdset: any) => !query || currentAdset.name.toLowerCase().includes(query) || currentAdset.campaignName.toLowerCase().includes(query));
    return sortLevelRows(rows, adsetSortKey, adsetSortAsc);
  }, [accountAdsets, adsetSortAsc, adsetSortKey, descendantCampaignIds, embeddedAdsetsById, endDate, salesForAd, search, startDate, statusFilter]);

  const selectedAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = accountAds
      .map((currentAd: any) => {
        const currentAdset = firstRelation(currentAd.adsets);
        const campaign = firstRelation(currentAdset?.campaigns);
        const metrics = aggregateInsights([embeddedAdsById.get(currentAd.id)].filter(Boolean), startDate, endDate);
        // A tabela de insights guarda leads, mas as campanhas de mensagem da
        // Meta registram o resultado em insight_actions. Sem esta composição,
        // os criativos exibiam cliques e investimento corretos, porém zero
        // resultados apesar de a campanha ter conversas iniciadas.
        const results = resolveCampaignResults(metrics.leads, actionData?.totalsByAd[currentAd.id] || {});
        const primaryResult = resolveCampaignPrimaryResult(campaign?.objective, results);
        const saleMetrics = salesForAd.get(currentAd.id) ?? { count: 0, revenue: 0 };
        return {
          ...currentAd,
          ...metrics,
          leads: primaryResult.value,
          results,
          resultLabel: primaryResult.label,
          costPerResult: primaryResult.value > 0 ? metrics.spend / primaryResult.value : 0,
          actionEvents: Object.entries(actionData?.totalsByAd[currentAd.id] || {})
            .map(([actionType, value]) => ({ actionType, value: Number(value || 0) }))
            .sort((a, b) => b.value - a.value),
          campaignId: currentAdset?.campaign_id,
          adsetName: currentAdset?.name || "Conjunto sem nome",
          campaignName: campaign?.name || "Campanha sem nome",
          sales: saleMetrics.count,
          revenue: saleMetrics.revenue,
        };
      })
      .filter((currentAd: any) => !descendantCampaignIds || descendantCampaignIds.has(currentAd.campaignId))
      .filter((currentAd: any) => statusFilter === "all" || normalizeStatus(currentAd.status) === statusFilter)
      .filter((currentAd: any) => !query || currentAd.name.toLowerCase().includes(query) || currentAd.adsetName.toLowerCase().includes(query) || currentAd.campaignName.toLowerCase().includes(query));
    return sortLevelRows(rows, adSortKey, adSortAsc);
  }, [accountAds, actionData?.totalsByAd, adSortAsc, adSortKey, descendantCampaignIds, embeddedAdsById, endDate, salesForAd, search, startDate, statusFilter]);

  const adsetTotals = useMemo(() => aggregateLevelTotals(selectedAdsets), [selectedAdsets]);
  const adTotals = useMemo(() => aggregateLevelTotals(selectedAds), [selectedAds]);
  useEffect(() => {
    const table = campaignTableScrollRef.current;
    const totalsBar = campaignTotalsScrollRef.current;
    if (!table || !totalsBar) return;

    const syncHorizontalPosition = () => { totalsBar.scrollLeft = table.scrollLeft; };
    syncHorizontalPosition();
    table.addEventListener("scroll", syncHorizontalPosition, { passive: true });
    return () => table.removeEventListener("scroll", syncHorizontalPosition);
  }, [activeTab, filtered.length, camp.colWidths]);
  useEffect(() => {
    const table = campaignTableScrollRef.current;
    if (!table || activeTab !== "campaigns") { setCampaignTotalsViewport(null); return; }
    const updateViewport = () => {
      const rect = table.getBoundingClientRect();
      const next = { left: rect.left, top: Math.min(rect.bottom - 64, window.innerHeight - 16 - 64), width: rect.width };
      setCampaignTotalsViewport((current) => current && current.left === next.left && current.top === next.top && current.width === next.width ? current : next);
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(table);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("scroll", updateViewport, true);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateViewport); window.removeEventListener("scroll", updateViewport, true); };
  }, [activeTab, camp.colWidths, filtered.length, isLoading]);
  const colorClass = (v: number) => v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "";
  const sortBg = (k: CampSortKey) => sortKey === k ? "bg-primary/5" : "";
  const showColumn = (key: CampaignColumnKey) => visibleColumns.has(key);
  const availableColumnFilters = useMemo(() => CAMPAIGN_COLUMN_FILTERS.filter((item) => !item.column || visibleColumns.has(item.column)), [visibleColumns]);
  const activeColumnFilterCount = Object.values(columnFilters).filter((value) => value.trim()).length;
  const cellW = (k: CampColKey) => ({ width: camp.colWidths[k], minWidth: camp.colWidths[k], maxWidth: camp.colWidths[k] });
  const adsetCellW = (k: AdsetColKey) => ({ width: adset.colWidths[k], minWidth: adset.colWidths[k], maxWidth: adset.colWidths[k] });
  const adCellW = (k: AdColKey) => ({ width: ad.colWidths[k], minWidth: ad.colWidths[k], maxWidth: ad.colWidths[k] });

  return (
    <MotionPage
      className={cn(
        "campaigns-workspace rounded-lg border border-border bg-card text-card-foreground shadow-sm dark:border-[#2a271f] dark:bg-[#070706]",
        analysisMode ? "overflow-visible" : "overflow-hidden md:flex md:min-h-0 md:flex-1 md:flex-col",
      )}
    >
      <MotionItem className="campaign-manager-top shrink-0 border-b border-border bg-card dark:border-[#2a271f] dark:bg-[#070706]">
        <div className="flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center gap-2">
            <h1 className="text-lg font-black tracking-tight">Campanhas</h1>
            <span className="campaign-brand-badge grid h-7 w-7 place-items-center rounded-md border text-[9px] font-black">GD</span>
          </div>
          {visibleAdAccounts.length > 0 && (
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="campaign-account-select h-8 w-full text-left text-xs sm:w-[260px] [&>span]:truncate [&>span]:text-left" aria-label="Trocar conta de anúncio"><SelectValue placeholder="Conta de anúncio" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as contas de anúncio</SelectItem>{visibleAdAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="campaign-opportunity-score grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[10px] font-black">{Math.max(0, Math.min(100, Math.round((healthCounts.healthy / Math.max(campaigns.length, 1)) * 100)))}</span>
            <span className="truncate">Pontuação de oportunidade</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className="hidden text-[10px] text-muted-foreground xl:inline">Atualizado {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
            <Button variant="outline" size="icon" onClick={handleSync} disabled={isFetching || syncMeta.isPending} className="h-8 w-8" title="Atualizar dados">
              <RefreshCw className={cn("h-3.5 w-3.5", (isFetching || syncMeta.isPending) && "animate-spin")} />
            </Button>
            <Button variant="outline" size="sm" disabled className="meta-toolbar-button hidden sm:inline-flex"><Send className="h-3.5 w-3.5" />Conferir e publicar</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" title="Mais opções"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="campaign-scope-toolbar growdash-scrollbar-hidden flex items-center gap-2 overflow-x-auto border-t border-border/60 px-3 py-2 dark:border-[#24221c]">
          <Button variant="outline" size="sm" className="campaign-scope-action meta-toolbar-button meta-toolbar-button-active shrink-0"><FolderOpen className="h-3.5 w-3.5" />Todos os anúncios</Button>
          <Button variant="outline" size="sm" className="campaign-scope-action meta-toolbar-button shrink-0" onClick={() => setStatusFilter("ACTIVE")}><Megaphone className="h-3.5 w-3.5" />Anúncios ativos</Button>
          <Button variant="outline" size="sm" className="campaign-scope-action meta-toolbar-button shrink-0"><ShieldCheck className="h-3.5 w-3.5" />Ações</Button>
          <Button variant="outline" size="sm" className="campaign-scope-action meta-toolbar-button shrink-0" onClick={() => setStatusFilter("ACTIVE")}><Eye className="h-3.5 w-3.5" />Tiveram veiculação</Button>
          <Button variant="ghost" size="sm" className="campaign-scope-action h-8 shrink-0 gap-2 text-[11px]"><Plus className="h-3.5 w-3.5" />Ver mais</Button>
          <Button variant="outline" size="sm" className="campaign-scope-action meta-toolbar-primary ml-auto shrink-0"><SlidersHorizontal className="h-3.5 w-3.5" />Criar visualização</Button>
        </div>

        <div className="border-t border-border/60 px-3 py-2 dark:border-[#24221c]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pesquise para filtrar por: nome, identificação ou métrica" value={search} onChange={(e) => setSearch(e.target.value)} className="campaign-search-input h-8 border-border bg-background pl-9 text-xs" />
          </div>
        </div>
      </MotionItem>

      {isError && <MotionItem className="border-b border-destructive/30 bg-destructive/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="font-black text-destructive">Erro ao carregar campanhas</h2><p className="text-xs text-muted-foreground">{campaignError instanceof Error ? campaignError.message : "Não foi possível consultar os dados."}</p></div><Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div></MotionItem>}

      <MotionItem className={cn(!analysisMode && "md:min-h-0 md:flex-1 md:overflow-hidden")}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className={cn(!analysisMode && "md:flex md:h-full md:min-h-0 md:flex-col")}>
          <div className="campaign-tabs-header growdash-scrollbar-hidden flex min-w-0 items-center overflow-x-auto border-b border-border bg-card dark:border-[#2a271f] dark:bg-[#070706]">
            <TabsList className="campaign-tabs-list h-auto w-max min-w-0 shrink-0 justify-start rounded-xl bg-transparent p-1">
              <TabsTrigger value="campaigns" className="campaign-hierarchy-tab h-10 min-w-[175px] shrink-0 justify-start gap-2 rounded-lg px-3 text-xs">
                <FolderKanban className="h-3.5 w-3.5" /> Campanhas ({filtered.length})
              </TabsTrigger>
              <TabsTrigger value="adsets" className="campaign-hierarchy-tab h-10 min-w-[210px] shrink-0 justify-start gap-2 rounded-lg px-3 text-xs">
                <Layers3 className="h-3.5 w-3.5" /> Conjuntos de anúncios ({selectedAdsets.length})
              </TabsTrigger>
              <TabsTrigger value="ads" className="campaign-hierarchy-tab h-10 min-w-[160px] shrink-0 justify-start gap-2 rounded-lg px-3 text-xs">
                <RectangleHorizontal className="h-3.5 w-3.5" /> Anúncios ({selectedAds.length})
              </TabsTrigger>
            </TabsList>
            <div className="campaign-date-filter ml-auto flex shrink-0 items-center px-2 py-1.5">
              <div className="w-[205px] [&_.gd-filter-date]:!w-full [&_.gd-filter-date]:!min-w-0 [&_button]:!h-8 [&_button]:!min-h-0 [&_button]:!px-2 [&_button]:text-[10px]"><DateFilterBar preset={preset} onPresetChange={setPreset} customRange={customRange} onCustomRangeChange={setCustomRange} startDate={startDate} endDate={endDate} adAccounts={[]} selectedAccount="" onAccountChange={() => {}} showSummary={false} /></div>
              <AccountMultiSelect accounts={visibleAdAccounts.map((account) => ({ id: account.id, name: account.name }))} selectedIds={selectedAccountIds} onChange={setSelectedAccountIds} className="h-8 min-h-0 w-[205px] text-[10px]" />
            </div>
          </div>

          <div className="campaign-actions-toolbar growdash-scrollbar-hidden flex min-h-11 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-border bg-card px-3 py-1.5 dark:border-[#2a271f] dark:bg-[#090908]">
            <div className="campaign-primary-actions flex shrink-0 items-center gap-2">
              <Button size="sm" className="campaign-action-button h-8 gap-2 bg-emerald-700 px-3 text-[11px] font-black text-white hover:bg-emerald-600" onClick={() => setCreateCampaignOpen(true)}><Plus className="h-3.5 w-3.5" />Criar</Button>
              <Button variant="outline" size="sm" className="campaign-action-button meta-toolbar-button" disabled={!selectedCampaign} onClick={() => selectedCampaign && setDuplicatingCampaign({ id: selectedCampaign.id, name: selectedCampaign.name, status: selectedCampaign.status })}><CopyIcon className="h-3.5 w-3.5" />Duplicar</Button>
              <Button variant="outline" size="sm" className="campaign-action-button meta-toolbar-button" disabled={!selectedCampaign} onClick={() => selectedCampaign && setEditingEntity({ type: "campaign", id: selectedCampaign.id, name: selectedCampaign.name, status: selectedCampaign.status, dailyBudget: selectedCampaign.daily_budget ?? selectedCampaign.budget })}><Pencil className="h-3.5 w-3.5" />Editar</Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="campaign-action-select h-8 w-full bg-background sm:w-[160px]"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="ACTIVE">Ativa</SelectItem><SelectItem value="PAUSED">Pausada</SelectItem><SelectItem value="ARCHIVED">Arquivada</SelectItem><SelectItem value="IN_PROCESS">Em análise</SelectItem></SelectContent></Select>
              <Button variant="outline" size="sm" onClick={() => { camp.reset(); adset.reset(); ad.reset(); }} className="campaign-action-button meta-toolbar-button"><RotateCcw className="h-3.5 w-3.5" />Resetar</Button>
            </div>
            <div className="campaign-secondary-actions ml-auto flex shrink-0 items-center gap-2">
              {activeTab === "campaigns" && <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={cn("meta-toolbar-button", analysisPanel && "meta-toolbar-button-active")}><BarChart3 className="h-3.5 w-3.5" />Análises<ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { const opening = analysisPanel !== "alerts"; updateAnalysisPanel(opening ? "alerts" : null); if (!opening) setHealthFilter("all"); }}><Sparkles className="mr-2 h-4 w-4 text-primary" />Alertas operacionais</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setHealthFilter("all"); updateAnalysisPanel(analysisPanel === "intelligence" ? null : "intelligence"); }}><BrainCircuit className="mr-2 h-4 w-4 text-primary" />Intelligence</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
              {activeTab === "campaigns" ? <MetaTableControls preset={columnPreset} columns={visibleColumns} breakdown={breakdown} onPreset={setColumnPreset} onColumns={setVisibleColumns} onBreakdown={setBreakdown} onRequestBreakdown={requestBreakdownSync} isRequestingBreakdown={syncMeta.isPending} /> : <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><SlidersHorizontal className="h-4 w-4" />Colunas redimensionáveis</span>}
              {activeTab === "campaigns" && <Button variant="outline" size="sm" className={cn("campaign-action-button meta-toolbar-button", columnFiltersOpen && "meta-toolbar-button-active")} onClick={() => setColumnFiltersOpen((open) => !open)}><SlidersHorizontal className="h-3.5 w-3.5" />Filtros por coluna{activeColumnFilterCount > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[8px]">{activeColumnFilterCount}</Badge>}</Button>}
            </div>
          </div>

          {activeTab === "campaigns" && columnFiltersOpen && (
            <section className="border-b border-border bg-muted/20 px-3 py-3" aria-label="Filtros individuais das colunas">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><h2 className="text-[11px] font-black">Filtrar cada coluna</h2><p className="text-[9px] text-muted-foreground">Os filtros são combinados e respeitam somente as colunas exibidas.</p></div>
                {activeColumnFilterCount > 0 && <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setColumnFilters({})}><X className="mr-1 h-3 w-3" />Limpar filtros</Button>}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 min-[900px]:grid-cols-7">
                {availableColumnFilters.map((filter) => <label key={filter.key} className="min-w-0"><span className="mb-1 block truncate text-[8px] font-black uppercase tracking-wide text-muted-foreground" title={filter.label}>{filter.label}</span><Input value={columnFilters[filter.key] || ""} onChange={(event) => setColumnFilters((current) => ({ ...current, [filter.key]: event.target.value }))} className="h-7 bg-background px-2 text-[10px]" placeholder="Filtrar…" /></label>)}
              </div>
            </section>
          )}

          <AnimatePresence>
            {selectedIds.size > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-10 flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-3 py-1.5">
              <Badge variant="secondary">{selectedIds.size} selecionada{selectedIds.size > 1 ? "s" : ""}</Badge>
              {activeTab === "campaigns" && <><Button size="sm" disabled={!selectedCampaign} onClick={() => selectedCampaign && setEditingEntity({ type: "campaign", id: selectedCampaign.id, name: selectedCampaign.name, status: selectedCampaign.status, dailyBudget: selectedCampaign.daily_budget ?? selectedCampaign.budget })} className="h-7 gap-1.5"><Pencil className="h-3.5 w-3.5" />Editar orçamento e campanha</Button><Button variant="outline" size="sm" disabled={!selectedCampaign} onClick={() => selectedCampaign && setDetailCampaignId(selectedCampaign.id)} className="h-7 gap-1.5"><Eye className="h-3.5 w-3.5" />Ver desempenho</Button></>}
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-7 gap-1 text-xs"><X className="h-3 w-3" />Limpar</Button>
            </motion.div>}
          </AnimatePresence>

          {activeTab !== "campaigns" && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-3 py-2 text-[11px]">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              {selectedIds.size === 0 ? (
                <span><b>Acesso livre à hierarquia:</b> exibindo todos os {activeTab === "adsets" ? "conjuntos de anúncios" : "anúncios"} das contas e filtros atuais. Não é necessário selecionar uma campanha.</span>
              ) : (
                <><span><b>Escopo filtrado:</b> descendentes de {selectedIds.size} campanha{selectedIds.size > 1 ? "s" : ""} selecionada{selectedIds.size > 1 ? "s" : ""}.</span><Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 text-xs" onClick={() => setSelectedIds(new Set())}><X className="h-3 w-3" />Mostrar todas</Button></>
              )}
            </div>
          )}

          {activeTab === "campaigns" && breakdown !== "none" && <BreakdownWorkspace label={getBreakdownLabel(breakdown)} supported={!!storageBreakdownType} loading={breakdownQuery.isLoading || syncMeta.isPending} rows={breakdownSegments} onSync={requestBreakdownSync} />}
          {activeTab === "campaigns" && analysisPanel === "alerts" && (
            <section className="campaign-analysis-shell border-b border-primary/20" data-analysis-content="alerts">
              <header className="campaign-analysis-header flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-primary" />Análises e alertas operacionais</h2>
                  <p className="text-[10px] text-muted-foreground">Conta: {visibleAdAccounts.find((account) => account.id === selectedAccount)?.name || "todas as contas selecionadas"} · {startDate.toLocaleDateString("pt-BR")}–{endDate.toLocaleDateString("pt-BR")}</p>
                </div>
              </header>

              <div className="border-b border-border p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 min-[900px]:grid-cols-6">
                  {isLoading ? Array.from({ length: 6 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg border border-border bg-muted/60" />) : HEALTH_OPTIONS.map((option) => {
                    const count = healthCounts[option.id];
                    const selected = healthFilter === option.id;
                    return <button key={option.id} type="button" title={`${count} campanha(s) classificadas como ${option.label.toLowerCase()} no período selecionado`} onClick={() => setHealthFilter(selected ? "all" : option.id)} className={cn("campaign-analysis-card flex min-h-14 min-w-0 items-center gap-2 px-3 text-left hover:bg-primary/5", selected && option.active, option.id === "critical" && count > 0 && "shadow-[0_0_18px_-10px_rgba(239,68,68,.9)]")} aria-pressed={selected}><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", option.dot, option.id === "critical" && count > 0 && "animate-pulse")} /><span className="min-w-0 grow"><span className="block truncate text-[9px] font-black uppercase tracking-wide">{option.label}</span><span className="block text-lg font-black tabular-nums">{count}</span></span></button>;
                  })}
                </div>

                {healthFilter !== "all" && (
                  <div className="mt-3 rounded-xl border border-border bg-background/55 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-black">Campanhas em {HEALTH_OPTIONS.find((option) => option.id === healthFilter)?.label}</h3>
                        <p className="text-[10px] text-muted-foreground">Clique em uma campanha para abrir o diagnóstico completo.</p>
                      </div>
                      <Badge variant="outline">{filtered.length} campanha(s)</Badge>
                    </div>
                    {filtered.length > 0 ? (
                      <div className="grid gap-2 lg:grid-cols-2">
                        {filtered.slice(0, 12).map((campaign: any) => <AnalysisCampaignAlert key={campaign.id} campaign={campaign} health={healthFilter} targetCpl={targetByCampaign.get(campaign.id) || averageCpl} accountName={visibleAdAccounts.find((account) => account.id === campaign.ad_account_id)?.name || "Conta Meta"} onOpen={() => setDetailCampaignId(campaign.id)} />)}
                      </div>
                    ) : <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Nenhuma campanha deste status nos filtros atuais.</p>}
                  </div>
                )}
              </div>

            </section>
          )}

          {activeTab === "campaigns" && analysisPanel === "intelligence" && (
            <CampaignIntelligence
              totals={totals}
              totalCtr={totalCtr}
              totalCpc={totalCpc}
              totalCpm={totalCpm}
              totalCpl={totalCpl}
              totalRoas={totalRoas}
              totalResultRate={totalResultRate}
              series={intelligenceSeries}
              campaigns={filtered}
              adsets={selectedAdsets}
              ads={selectedAds}
              accountId={selectedAccount}
              accountName={visibleAdAccounts.find((account) => account.id === selectedAccount)?.name}
              startDate={startDate}
              endDate={endDate}
              selectedCampaignIds={Array.from(selectedIds)}
            />
          )}

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className={cn("m-0", !analysisMode && "md:min-h-0 md:flex-1 md:overflow-hidden")}>
            {isLoading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />)}</div>
            ) : (
              <Card className={cn(
                "campaign-table-frame relative min-h-0 overflow-hidden rounded-none border-0 shadow-none md:flex md:flex-col",
                analysisMode
                  ? "md:h-[clamp(560px,68vh,720px)] md:min-h-[560px]"
                  : "md:h-[clamp(300px,calc(100dvh-26rem),640px)] md:min-h-0",
              )} style={analysisMode ? undefined : { height: "clamp(300px, calc(100vh - 26rem), 640px)" }}>
                <div className="space-y-2 p-2 md:hidden">
                  {visibleCampaigns.map((campaign: any) => <CampaignMobileCard key={campaign.id} campaign={campaign} selected={selectedIds.has(campaign.id)} health={getCampaignHealth(campaign, averageCpl, targetByCampaign.get(campaign.id))} onSelect={() => toggleSelect(campaign.id)} onOpen={() => setDetailCampaignId(campaign.id)} onEdit={() => setEditingEntity({ type: "campaign", id: campaign.id, name: campaign.name, status: campaign.status, dailyBudget: campaign.daily_budget ?? campaign.budget })} />)}
                </div>
                <div
                  ref={campaignTableScrollRef}
                  data-campaign-table-scroll
                  className={cn(
                    "growdash-scrollbar-hidden hidden min-h-0 flex-1 overflow-auto md:block",
                  )}
                >
                  <table className="w-full caption-bottom text-sm" style={{ tableLayout: "fixed", width: "max-content" }}>
                    <TableHeader className="sticky top-0 z-50 shadow-[0_2px_8px_rgba(0,0,0,.08)]">
                      <TableRow className="campaign-metric-header h-10 border-b border-border hover:bg-transparent [&>th]:h-10 [&>th]:px-3 [&>th]:py-1 dark:border-[#28251e]">
                        <ResizableHead colKey="check" width={camp.colWidths.check} onResize={camp.startResize("check")} className="sticky left-0 z-40 bg-muted dark:bg-[#11110f]">
                          <Checkbox className="h-4 w-4 rounded-full border-primary/80" checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                        </ResizableHead>
                        <ResizableHead colKey="delivery" width={camp.colWidths.delivery} onResize={camp.startResize("delivery")} sortable sortableKey="status" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="sticky z-40 bg-muted dark:bg-[#11110f]" style={{ left: camp.colWidths.check }}>Status</ResizableHead>
                        <ResizableHead colKey="name" width={camp.colWidths.name} onResize={camp.startResize("name")} sortable sortableKey="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="sticky z-40 border-r border-border bg-muted shadow-[8px_0_14px_-14px_rgba(0,0,0,.85)] dark:border-[#28251e] dark:bg-[#11110f]" style={{ left: camp.colWidths.check + camp.colWidths.delivery }}>Campanha</ResizableHead>
                        {showColumn("deliveryStatus") && <ResizableHead colKey="deliveryStatus" width={camp.colWidths.deliveryStatus} onResize={camp.startResize("deliveryStatus")}>Veiculação</ResizableHead>}
                        {showColumn("actions") && <ResizableHead colKey="actions" width={camp.colWidths.actions} onResize={camp.startResize("actions")}>Ações</ResizableHead>}
                        {showColumn("reach") && <ResizableHead colKey="reach" width={camp.colWidths.reach} onResize={camp.startResize("reach")} sortable sortableKey="reach" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Alcance</ResizableHead>}
                        {showColumn("impressions") && <ResizableHead colKey="impressions" width={camp.colWidths.impressions} onResize={camp.startResize("impressions")} sortable sortableKey="impressions" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Impressões</ResizableHead>}
                        {showColumn("frequency") && <ResizableHead colKey="frequency" width={camp.colWidths.frequency} onResize={camp.startResize("frequency")} sortable sortableKey="frequency" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Frequência</ResizableHead>}
                        {showColumn("linkClicks") && <ResizableHead colKey="linkClicks" width={camp.colWidths.linkClicks} onResize={camp.startResize("linkClicks")} sortable sortableKey="linkClicks" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Cliques no link</ResizableHead>}
                        {showColumn("linkCpc") && <ResizableHead colKey="linkCpc" width={camp.colWidths.linkCpc} onResize={camp.startResize("linkCpc")} sortable sortableKey="linkCpc" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPC (clique no link)</ResizableHead>}
                        {showColumn("uniqueLinkCtr") && <ResizableHead colKey="uniqueLinkCtr" width={camp.colWidths.uniqueLinkCtr} onResize={camp.startResize("uniqueLinkCtr")} sortable sortableKey="uniqueLinkCtr" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CTR único (link)</ResizableHead>}
                        {showColumn("cpm") && <ResizableHead colKey="cpm" width={camp.colWidths.cpm} onResize={camp.startResize("cpm")} sortable sortableKey="cpm" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPM</ResizableHead>}
                        {showColumn("budget") && <ResizableHead colKey="budget" width={camp.colWidths.budget} onResize={camp.startResize("budget")} sortable sortableKey="budget" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Orçamento</ResizableHead>}
                        {showColumn("leads") && <ResizableHead colKey="leads" width={camp.colWidths.leads} onResize={camp.startResize("leads")} sortable sortableKey="leads" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Resultado</ResizableHead>}
                        {showColumn("cpl") && <ResizableHead colKey="cpl" width={camp.colWidths.cpl} onResize={camp.startResize("cpl")} sortable sortableKey="cpl" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Custo por resultado</ResizableHead>}
                        {showColumn("spend") && <ResizableHead colKey="spend" width={camp.colWidths.spend} onResize={camp.startResize("spend")} sortable sortableKey="spend" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Valor usado</ResizableHead>}
                        {showColumn("landingPageViews") && <ResizableHead colKey="landingPageViews" width={camp.colWidths.landingPageViews} onResize={camp.startResize("landingPageViews")} sortable sortableKey="landingPageViews" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Visualização da página de destino</ResizableHead>}
                        {showColumn("costPerLandingPageView") && <ResizableHead colKey="costPerLandingPageView" width={camp.colWidths.costPerLandingPageView} onResize={camp.startResize("costPerLandingPageView")} sortable sortableKey="costPerLandingPageView" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Custo por visualização da página</ResizableHead>}
                        {showColumn("checkouts") && <ResizableHead colKey="checkouts" width={camp.colWidths.checkouts} onResize={camp.startResize("checkouts")} sortable sortableKey="checkouts" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Finalização de compra iniciada</ResizableHead>}
                        {showColumn("costPerCheckout") && <ResizableHead colKey="costPerCheckout" width={camp.colWidths.costPerCheckout} onResize={camp.startResize("costPerCheckout")} sortable sortableKey="costPerCheckout" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Custo por finalização de compra</ResizableHead>}
                        {showColumn("metaPurchases") && <ResizableHead colKey="metaPurchases" width={camp.colWidths.metaPurchases} onResize={camp.startResize("metaPurchases")} sortable sortableKey="metaPurchases" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Compras</ResizableHead>}
                        {showColumn("metaCostPerPurchase") && <ResizableHead colKey="metaCostPerPurchase" width={camp.colWidths.metaCostPerPurchase} onResize={camp.startResize("metaCostPerPurchase")} sortable sortableKey="metaCostPerPurchase" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Custo por compra</ResizableHead>}
                        {showColumn("metaPurchaseRoas") && <ResizableHead colKey="metaPurchaseRoas" width={camp.colWidths.metaPurchaseRoas} onResize={camp.startResize("metaPurchaseRoas")} sortable sortableKey="metaPurchaseRoas" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">ROAS</ResizableHead>}
                        {showColumn("objective") && <ResizableHead colKey="objective" width={camp.colWidths.objective} onResize={camp.startResize("objective")} sortable sortableKey="objective" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort}>Objetivo</ResizableHead>}
                        {showColumn("clicks") && <ResizableHead colKey="clicks" width={camp.colWidths.clicks} onResize={camp.startResize("clicks")} sortable sortableKey="clicks" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Cliques</ResizableHead>}
                        {showColumn("cpc") && <ResizableHead colKey="cpc" width={camp.colWidths.cpc} onResize={camp.startResize("cpc")} sortable sortableKey="cpc" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPC</ResizableHead>}
                        {showColumn("ctr") && <ResizableHead colKey="ctr" width={camp.colWidths.ctr} onResize={camp.startResize("ctr")} sortable sortableKey="ctr" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CTR</ResizableHead>}
                        {showColumn("conversion") && <ResizableHead colKey="conversion" width={camp.colWidths.conversion} onResize={camp.startResize("conversion")} sortable sortableKey="conversionRate" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Taxa de conversão</ResizableHead>}
                        {showColumn("sales") && <ResizableHead colKey="sales" width={camp.colWidths.sales} onResize={camp.startResize("sales")} sortable sortableKey="salesCount" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Vendas</ResizableHead>}
                        {showColumn("cpa") && <ResizableHead colKey="cpa" width={camp.colWidths.cpa} onResize={camp.startResize("cpa")} sortable sortableKey="cpa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPA</ResizableHead>}
                        {showColumn("revenue") && <ResizableHead colKey="revenue" width={camp.colWidths.revenue} onResize={camp.startResize("revenue")} sortable sortableKey="revenue" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Valor de conversão</ResizableHead>}
                        {showColumn("roas") && <ResizableHead colKey="roas" width={camp.colWidths.roas} onResize={camp.startResize("roas")} sortable sortableKey="roas" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">ROAS</ResizableHead>}
                        {showColumn("profit") && <ResizableHead colKey="profit" width={camp.colWidths.profit} onResize={camp.startResize("profit")} sortable sortableKey="profit" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Lucro</ResizableHead>}
                        {showColumn("roi") && <ResizableHead colKey="roi" width={camp.colWidths.roi} onResize={camp.startResize("roi")} sortable sortableKey="roi" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">ROI</ResizableHead>}
                        {showColumn("videoViews") && <ResizableHead colKey="videoViews" width={camp.colWidths.videoViews} onResize={camp.startResize("videoViews")} align="right">Reproduções de vídeo</ResizableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {visibleCampaigns.map((c: any, rowIndex: number) => {
                          const stickySurface = selectedIds.has(c.id) ? "bg-muted dark:bg-[#202020]" : rowIndex % 2 ? "bg-muted dark:bg-[#0c0c0b]" : "bg-card dark:bg-[#070706]";
                          return (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`group h-11 cursor-pointer border-b border-border transition-colors hover:bg-muted/60 [&>td]:px-3 [&>td]:py-1 dark:border-[#242424] dark:hover:bg-[#181818] ${selectedIds.has(c.id) ? "bg-muted/70" : "odd:bg-card even:bg-muted/20 dark:odd:bg-[#070706] dark:even:bg-[#0c0c0b]"}`}
                            onClick={() => setDetailCampaignId(c.id)}
                          >
                            <TableCell style={{ ...cellW("check"), left: 0 }} className={cn("sticky z-20 transition-colors group-hover:bg-muted", stickySurface)} onClick={(e) => e.stopPropagation()}>
                              <Checkbox className="h-4 w-4 rounded-full border-primary/80" checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                            </TableCell>
                            <TableCell style={{ ...cellW("delivery"), left: camp.colWidths.check }} className={cn("sticky z-20 transition-colors group-hover:bg-muted", stickySurface)} onClick={(event) => event.stopPropagation()}>
                              <div className="flex items-center gap-2 text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setEditingEntity({ type: "campaign", id: c.id, name: c.name, status: c.status, dailyBudget: c.daily_budget ?? c.budget })}
                                  className={cn(
                                    "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                                    normalizeStatus(c.status) === "ACTIVE"
                                      ? "border-emerald-600/70 bg-emerald-500"
                                      : "border-border bg-muted",
                                  )}
                                  title="Editar status na Meta Ads"
                                >
                                  <span className={cn(
                                    "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all",
                                    normalizeStatus(c.status) === "ACTIVE" ? "left-[17px]" : "left-0.5",
                                  )} />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell style={{ ...cellW("name"), left: camp.colWidths.check + camp.colWidths.delivery }} className={cn("sticky z-20 border-r border-border/80 font-medium shadow-[8px_0_14px_-14px_rgba(0,0,0,.85)] transition-colors group-hover:bg-muted", stickySurface)}>
                              <span className="block truncate font-medium text-foreground" title={c.name}>{c.name}</span>
                            </TableCell>
                            {showColumn("deliveryStatus") && <TableCell style={cellW("deliveryStatus")} className="text-xs"><span className="inline-flex items-center gap-2"><StatusDot status={c.status} />{getStatusBadge(c.status).label}</span></TableCell>}
                            {showColumn("actions") && <TableCell style={cellW("actions")} onClick={(event) => event.stopPropagation()}><Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setEditingEntity({ type: "campaign", id: c.id, name: c.name, status: c.status, dailyBudget: c.daily_budget ?? c.budget })}><Pencil className="mr-1 h-3 w-3" />Editar</Button></TableCell>}
                            {showColumn("reach") && <TableCell style={cellW("reach")} className={cn("text-right tabular-nums text-sm", sortBg("reach"))}><AnimatedNumber value={c.reach} decimals={0} /></TableCell>}
                            {showColumn("impressions") && <TableCell style={cellW("impressions")} className={cn("text-right tabular-nums text-sm", sortBg("impressions"))}><AnimatedNumber value={c.impressions} decimals={0} /></TableCell>}
                            {showColumn("frequency") && <TableCell style={cellW("frequency")} className={cn("text-right tabular-nums text-sm", sortBg("frequency"))}><AnimatedNumber value={c.frequency} decimals={2} /></TableCell>}
                            {showColumn("linkClicks") && <TableCell style={cellW("linkClicks")} className={cn("text-right tabular-nums text-sm", sortBg("linkClicks"))}><AnimatedNumber value={c.linkClicks} decimals={0} /></TableCell>}
                            {showColumn("linkCpc") && <TableCell style={cellW("linkCpc")} className={cn("text-right tabular-nums text-sm", sortBg("linkCpc"))}><AnimatedNumber value={c.linkCpc} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("uniqueLinkCtr") && <TableCell style={cellW("uniqueLinkCtr")} className={cn("text-right tabular-nums text-sm", sortBg("uniqueLinkCtr"))}><AnimatedNumber value={c.uniqueLinkCtr} suffix="%" decimals={2} /></TableCell>}
                            {showColumn("cpm") && <TableCell style={cellW("cpm")} className={cn("text-right tabular-nums text-sm", sortBg("cpm"))}><AnimatedNumber value={c.cpm} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("budget") && <TableCell style={cellW("budget")} className={cn("text-right tabular-nums text-sm", sortBg("budget"))}><AnimatedNumber value={c.budget} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("leads") && <TableCell style={cellW("leads")} className={cn("text-right tabular-nums text-sm", sortBg("leads"))} onClick={(event) => event.stopPropagation()}><CampaignResultCell campaign={c} onOpen={() => setDetailCampaignId(c.id)} /></TableCell>}
                            {showColumn("cpl") && <TableCell style={cellW("cpl")} className={cn("text-right tabular-nums text-sm", sortBg("cpl"))}><AnimatedNumber value={c.costPerResult ?? c.cpl} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("spend") && <TableCell style={cellW("spend")} className={cn("text-right tabular-nums text-sm", sortBg("spend"))}><AnimatedNumber value={c.spend} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("landingPageViews") && <TableCell style={cellW("landingPageViews")} className={cn("text-right tabular-nums text-sm", sortBg("landingPageViews"))}><AnimatedNumber value={c.landingPageViews} decimals={0} /></TableCell>}
                            {showColumn("costPerLandingPageView") && <TableCell style={cellW("costPerLandingPageView")} className={cn("text-right tabular-nums text-sm", sortBg("costPerLandingPageView"))}><AnimatedNumber value={c.costPerLandingPageView} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("checkouts") && <TableCell style={cellW("checkouts")} className={cn("text-right tabular-nums text-sm", sortBg("checkouts"))}><AnimatedNumber value={c.checkouts} decimals={0} /></TableCell>}
                            {showColumn("costPerCheckout") && <TableCell style={cellW("costPerCheckout")} className={cn("text-right tabular-nums text-sm", sortBg("costPerCheckout"))}><AnimatedNumber value={c.costPerCheckout} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("metaPurchases") && <TableCell style={cellW("metaPurchases")} className={cn("text-right tabular-nums text-sm", sortBg("metaPurchases"))}><AnimatedNumber value={c.metaPurchases} decimals={0} /></TableCell>}
                            {showColumn("metaCostPerPurchase") && <TableCell style={cellW("metaCostPerPurchase")} className={cn("text-right tabular-nums text-sm", sortBg("metaCostPerPurchase"))}><AnimatedNumber value={c.metaCostPerPurchase} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("metaPurchaseRoas") && <TableCell style={cellW("metaPurchaseRoas")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.metaPurchaseRoas), sortBg("metaPurchaseRoas"))}><AnimatedNumber value={c.metaPurchaseRoas} suffix="x" decimals={2} /></TableCell>}
                            {showColumn("objective") && <TableCell style={cellW("objective")} className="truncate text-xs text-muted-foreground" title={c.objective || "Não informado"}>{c.objective || "—"}</TableCell>}
                            {showColumn("clicks") && <TableCell style={cellW("clicks")} className={cn("text-right tabular-nums text-sm", sortBg("clicks"))}><AnimatedNumber value={c.clicks} decimals={0} /></TableCell>}
                            {showColumn("cpc") && <TableCell style={cellW("cpc")} className={cn("text-right tabular-nums text-sm", sortBg("cpc"))}><AnimatedNumber value={c.cpc} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("ctr") && <TableCell style={cellW("ctr")} className={cn("text-right tabular-nums text-sm", sortBg("ctr"))}><AnimatedNumber value={c.ctr} suffix="%" decimals={2} /></TableCell>}
                            {showColumn("conversion") && <TableCell style={cellW("conversion")} className={cn("text-right tabular-nums text-sm", sortBg("conversionRate"))}><AnimatedNumber value={c.conversionRate} suffix="%" decimals={2} /></TableCell>}
                            {showColumn("sales") && <TableCell style={cellW("sales")} className={cn("text-right tabular-nums text-sm", sortBg("salesCount"))}><AnimatedNumber value={c.salesCount} decimals={0} /></TableCell>}
                            {showColumn("cpa") && <TableCell style={cellW("cpa")} className={cn("text-right tabular-nums text-sm", sortBg("cpa"))}><AnimatedNumber value={c.cpa} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("revenue") && <TableCell style={cellW("revenue")} className={cn("text-right tabular-nums text-sm", sortBg("revenue"))}><AnimatedNumber value={c.revenue} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("roas") && <TableCell style={cellW("roas")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.roas), sortBg("roas"))}><AnimatedNumber value={c.roas} suffix="x" decimals={2} /></TableCell>}
                            {showColumn("profit") && <TableCell style={cellW("profit")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.profit), sortBg("profit"))}><AnimatedNumber value={c.profit} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("roi") && <TableCell style={cellW("roi")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.roi), sortBg("roi"))}><AnimatedNumber value={c.roi} suffix="%" decimals={1} /></TableCell>}
                            {showColumn("videoViews") && <TableCell style={cellW("videoViews")} className="text-right text-sm text-muted-foreground">—<span className="block text-[8px]">não sincronizado</span></TableCell>}
                          </motion.tr>
                        );})}
                      </AnimatePresence>
                    </TableBody>
                    {false && (() => {
                      const footer = <TableFooter className="sticky bottom-0 z-40">
                      <TableRow data-campaign-totals className="sticky bottom-0 z-40 h-14 border-0 bg-card hover:bg-card dark:border-[#2a271f] dark:bg-[#070706] dark:hover:bg-[#070706] [&>td]:px-3 [&>td]:py-1">
                        <CampaignTotalCell width={camp.colWidths.check} stickyLeft={0} />
                        <CampaignTotalCell width={camp.colWidths.delivery} stickyLeft={camp.colWidths.check} />
                        <CampaignTotalCell
                          width={camp.colWidths.name}
                          value={`Totais (${filtered.length})`}
                          label="Linhas visíveis após filtros e busca"
                          align="left"
                          stickyLeft={camp.colWidths.check + camp.colWidths.delivery}
                          strongDivider
                        />
                        {showColumn("deliveryStatus") && <CampaignTotalCell width={camp.colWidths.deliveryStatus} value="—" />}
                        {showColumn("actions") && <CampaignTotalCell width={camp.colWidths.actions} value="—" />}
                        {showColumn("reach") && <CampaignTotalCell width={camp.colWidths.reach} value={totals.reach.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("impressions") && <CampaignTotalCell width={camp.colWidths.impressions} value={totals.impressions.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("frequency") && <CampaignTotalCell width={camp.colWidths.frequency} value={totals.reach > 0 ? (totals.impressions / totals.reach).toFixed(2).replace(".", ",") : "0,00"} label="Média" />}
                        {showColumn("linkClicks") && <CampaignTotalCell width={camp.colWidths.linkClicks} value={totals.linkClicks.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("linkCpc") && <CampaignTotalCell width={camp.colWidths.linkCpc} value={totalLinkCpc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por clique no link" />}
                        {showColumn("uniqueLinkCtr") && <CampaignTotalCell width={camp.colWidths.uniqueLinkCtr} value={`${totalUniqueLinkCtr.toFixed(2).replace(".", ",")}%`} label="Taxa total" />}
                        {showColumn("cpm") && <CampaignTotalCell width={camp.colWidths.cpm} value={totalCpm.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por 1.000 impressões" />}
                        {showColumn("budget") && <CampaignTotalCell width={camp.colWidths.budget} value={totals.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Orçamento somado" />}
                        {showColumn("leads") && <CampaignTotalCell width={camp.colWidths.leads} value={totals.results.toLocaleString("pt-BR")} label={`${totals.conversations.toLocaleString("pt-BR")} conversas · ${totals.formLeads.toLocaleString("pt-BR")} forms/site`} />}
                        {showColumn("cpl") && <CampaignTotalCell width={camp.colWidths.cpl} value={totalCpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por resultado" />}
                        {showColumn("spend") && <CampaignTotalCell width={camp.colWidths.spend} value={totals.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Total usado" />}
                        {showColumn("landingPageViews") && <CampaignTotalCell width={camp.colWidths.landingPageViews} value={totals.landingPageViews.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("costPerLandingPageView") && <CampaignTotalCell width={camp.colWidths.costPerLandingPageView} value={totalCostPerLandingPageView.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por visualização" />}
                        {showColumn("checkouts") && <CampaignTotalCell width={camp.colWidths.checkouts} value={totals.checkouts.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("costPerCheckout") && <CampaignTotalCell width={camp.colWidths.costPerCheckout} value={totalCostPerCheckout.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por finalização" />}
                        {showColumn("metaPurchases") && <CampaignTotalCell width={camp.colWidths.metaPurchases} value={totals.metaPurchases.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("metaCostPerPurchase") && <CampaignTotalCell width={camp.colWidths.metaCostPerPurchase} value={totalMetaCostPerPurchase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por compra" />}
                        {showColumn("metaPurchaseRoas") && <CampaignTotalCell width={camp.colWidths.metaPurchaseRoas} value={`${totalMetaPurchaseRoas.toFixed(2).replace(".", ",")}x`} label="Retorno total" />}
                        {showColumn("objective") && <CampaignTotalCell width={camp.colWidths.objective} value="—" />}
                        {showColumn("clicks") && <CampaignTotalCell width={camp.colWidths.clicks} value={totals.clicks.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("cpc") && <CampaignTotalCell width={camp.colWidths.cpc} value={totalCpc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por clique" />}
                        {showColumn("ctr") && <CampaignTotalCell width={camp.colWidths.ctr} value={`${totalCtr.toFixed(2).replace(".", ",")}%`} label="Taxa total" />}
                        {showColumn("conversion") && <CampaignTotalCell width={camp.colWidths.conversion} value={`${totalResultRate.toFixed(2).replace(".", ",")}%`} label="Taxa total" />}
                        {showColumn("sales") && <CampaignTotalCell width={camp.colWidths.sales} value={totals.salesCount.toLocaleString("pt-BR")} label="Total" />}
                        {showColumn("cpa") && <CampaignTotalCell width={camp.colWidths.cpa} value={(totals.salesCount > 0 ? totals.spend / totals.salesCount : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Por venda" />}
                        {showColumn("revenue") && <CampaignTotalCell width={camp.colWidths.revenue} value={totals.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Valor total" />}
                        {showColumn("roas") && <CampaignTotalCell width={camp.colWidths.roas} value={`${totalRoas.toFixed(2).replace(".", ",")}x`} label="Retorno total" />}
                        {showColumn("profit") && <CampaignTotalCell width={camp.colWidths.profit} value={totals.profit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} label="Total" />}
                        {showColumn("roi") && <CampaignTotalCell width={camp.colWidths.roi} value={`${(totals.spend > 0 ? totals.profit / totals.spend * 100 : 0).toFixed(1).replace(".", ",")}%`} label="Retorno total" />}
                        {showColumn("videoViews") && <CampaignTotalCell width={camp.colWidths.videoViews} value="—" label="Não sincronizado" />}
                      </TableRow>
                    </TableFooter>;

                      // The summary belongs to the same scroll container as
                      // the data rows. This keeps it visible while scrolling
                      // vertically and precisely aligned with every column.
                      return footer;
                    })()}
                  </table>
                </div>
                {activeTab === "campaigns" && campaignTotalsViewport && createPortal(
                  <div
                    ref={campaignTotalsScrollRef}
                    className="campaign-fixed-total-bar hidden overflow-hidden border border-border bg-card shadow-2xl md:block dark:border-[#2a271f] dark:bg-[#070706]"
                    style={{ position: "fixed", left: campaignTotalsViewport.left, top: campaignTotalsViewport.top, width: campaignTotalsViewport.width, height: "64px", zIndex: 1000 }}
                    aria-label="Totais das campanhas filtradas"
                  >
                    <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                      <TableBody>
                        <CampaignTotalsRow
                          widths={camp.colWidths}
                          visibleColumns={visibleColumns}
                          count={filtered.length}
                          totals={totals}
                          totalCpm={totalCpm}
                          totalCpl={totalCpl}
                          totalCpc={totalCpc}
                          totalCtr={totalCtr}
                          totalRoas={totalRoas}
                          totalLinkCpc={totalLinkCpc}
                          totalUniqueLinkCtr={totalUniqueLinkCtr}
                          totalCostPerLandingPageView={totalCostPerLandingPageView}
                          totalCostPerCheckout={totalCostPerCheckout}
                          totalMetaCostPerPurchase={totalMetaCostPerPurchase}
                          totalMetaPurchaseRoas={totalMetaPurchaseRoas}
                          totalResultRate={totalResultRate}
                        />
                      </TableBody>
                    </Table>
                  </div>,
                  document.body,
                )}
                {!analysisMode && pageCount > 1 && <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-border/60 px-3 dark:border-[#24221c]"><span className="text-[9px] text-muted-foreground">Exibindo {campaignPage * pageSize + 1}–{Math.min((campaignPage + 1) * pageSize, filtered.length)} de {filtered.length}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCampaignPage((page) => Math.max(0, page - 1))} disabled={campaignPage === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="min-w-16 text-center text-[9px]">{campaignPage + 1} / {pageCount}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCampaignPage((page) => Math.min(pageCount - 1, page + 1))} disabled={campaignPage + 1 >= pageCount}><ChevronRight className="h-3.5 w-3.5" /></Button></div></div>}
              </Card>
            )}
          </TabsContent>

          {/* Adsets Tab */}
          <TabsContent value="adsets" className="m-0 md:min-h-0 md:flex-1 md:overflow-hidden">
            <Card className="overflow-hidden rounded-none border-0 shadow-none md:flex md:h-full md:min-h-0 md:flex-col">
              {isLoadingAdsets ? <LevelLoading /> : selectedAdsets.length === 0 ? <LevelEmpty level="conjuntos de anúncios" selected={selectedIds.size > 0} onClear={() => setSelectedIds(new Set())} /> : <>
              <div className="space-y-2 p-2 md:hidden">{selectedAdsets.map((entity: any) => <LevelMobileCard key={entity.id} entity={{ ...entity, type: "adset" }} onOpen={() => setDetailEntity({ ...entity, type: "adset" })} />)}</div>
              <div className="growdash-scrollbar hidden min-h-0 flex-1 overflow-auto md:block">
                <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                  <TableHeader className="sticky top-0 z-40 shadow-[0_2px_8px_rgba(0,0,0,.08)]">
                    <TableRow className="campaign-metric-header h-11 hover:bg-transparent">
                      <ResizableHead colKey="name" width={adset.colWidths.name} onResize={adset.startResize("name")} sortable sortableKey="name" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort}>Conjunto</ResizableHead>
                      <ResizableHead colKey="campaign" width={adset.colWidths.campaign} onResize={adset.startResize("campaign")} sortable sortableKey="campaign" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort}>Campanha</ResizableHead>
                      <ResizableHead colKey="spend" width={adset.colWidths.spend} onResize={adset.startResize("spend")} sortable sortableKey="spend" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Gastos</ResizableHead>
                      <ResizableHead colKey="budget" width={adset.colWidths.budget} onResize={adset.startResize("budget")} sortable sortableKey="budget" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Orçamento Diário</ResizableHead>
                      <ResizableHead colKey="impressions" width={adset.colWidths.impressions} onResize={adset.startResize("impressions")} sortable sortableKey="impressions" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Impressões</ResizableHead>
                      <ResizableHead colKey="cpm" width={adset.colWidths.cpm} onResize={adset.startResize("cpm")} sortable sortableKey="cpm" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">CPM</ResizableHead>
                      <ResizableHead colKey="reach" width={adset.colWidths.reach} onResize={adset.startResize("reach")} sortable sortableKey="reach" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Alcance*</ResizableHead>
                      <ResizableHead colKey="frequency" width={adset.colWidths.frequency} onResize={adset.startResize("frequency")} sortable sortableKey="frequency" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Frequência*</ResizableHead>
                      <ResizableHead colKey="clicks" width={adset.colWidths.clicks} onResize={adset.startResize("clicks")} sortable sortableKey="clicks" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Cliques</ResizableHead>
                      <ResizableHead colKey="ctr" width={adset.colWidths.ctr} onResize={adset.startResize("ctr")} sortable sortableKey="ctr" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">CTR</ResizableHead>
                      <ResizableHead colKey="cpc" width={adset.colWidths.cpc} onResize={adset.startResize("cpc")} sortable sortableKey="cpc" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">CPC</ResizableHead>
                      <ResizableHead colKey="leads" width={adset.colWidths.leads} onResize={adset.startResize("leads")} sortable sortableKey="leads" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Resultados</ResizableHead>
                      <ResizableHead colKey="cpl" width={adset.colWidths.cpl} onResize={adset.startResize("cpl")} sortable sortableKey="cpl" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Custo por resultado</ResizableHead>
                      <ResizableHead colKey="sales" width={adset.colWidths.sales} onResize={adset.startResize("sales")} sortable sortableKey="sales" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Vendas</ResizableHead>
                      <ResizableHead colKey="revenue" width={adset.colWidths.revenue} onResize={adset.startResize("revenue")} sortable sortableKey="revenue" sortKey={adsetSortKey} sortAsc={adsetSortAsc} onSort={handleAdsetSort} align="right">Valor das vendas</ResizableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAdsets.map((a: any) => (
                      <TableRow key={a.id} className="h-12 cursor-pointer odd:bg-card even:bg-muted/20 hover:bg-primary/5" onClick={() => setDetailEntity({ ...a, type: "adset" })}>
                        <TableCell style={adsetCellW("name")} className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusDot status={a.status} />
                            <span className="truncate" title={a.name}>{a.name}</span>
                            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0" onClick={(event) => { event.stopPropagation(); setEditingEntity({ type: "adset", id: a.id, name: a.name, status: a.status, dailyBudget: a.daily_budget }); }} title="Editar conjunto na Meta Ads">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell style={adsetCellW("campaign")} className="text-muted-foreground text-sm truncate" title={a.campaignName}>{a.campaignName}</TableCell>
                        <TableCell style={adsetCellW("spend")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.spend} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("budget")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.daily_budget ?? 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("impressions")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("cpm")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions > 0 ? a.spend / a.impressions * 1000 : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("reach")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.reach} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("frequency")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.reach > 0 ? a.impressions / a.reach : 0} decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("clicks")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.clicks} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("ctr")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions > 0 ? a.clicks / a.impressions * 100 : 0} suffix="%" decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("cpc")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.clicks > 0 ? a.spend / a.clicks : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("leads")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("cpl")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads > 0 ? a.spend / a.leads : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adsetCellW("sales")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.sales} decimals={0} /></TableCell>
                        <TableCell style={adsetCellW("revenue")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.revenue} prefix="R$ " decimals={2} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <LevelTotals label="conjuntos" count={selectedAdsets.length} totals={adsetTotals} />
              </>}
            </Card>
          </TabsContent>

          {/* Ads Tab */}
          <TabsContent value="ads" className="m-0 md:min-h-0 md:flex-1 md:overflow-hidden">
            <Card className="overflow-hidden rounded-none border-0 shadow-none md:flex md:h-full md:min-h-0 md:flex-col">
              {isLoadingAds ? <LevelLoading /> : selectedAds.length === 0 ? <LevelEmpty level="anúncios" selected={selectedIds.size > 0} onClear={() => setSelectedIds(new Set())} /> : <>
              <div className="space-y-2 p-2 md:hidden">{selectedAds.map((entity: any) => <LevelMobileCard key={entity.id} entity={{ ...entity, type: "ad" }} onOpen={() => setDetailEntity({ ...entity, type: "ad" })} />)}</div>
              <div className="growdash-scrollbar hidden min-h-0 flex-1 overflow-auto md:block">
                <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                  <TableHeader className="sticky top-0 z-40 shadow-[0_2px_8px_rgba(0,0,0,.08)]">
                    <TableRow className="campaign-metric-header h-11 hover:bg-transparent">
                      <ResizableHead colKey="name" width={ad.colWidths.name} onResize={ad.startResize("name")} sortable sortableKey="name" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort}>Anúncio</ResizableHead>
                      <ResizableHead colKey="adset" width={ad.colWidths.adset} onResize={ad.startResize("adset")} sortable sortableKey="adset" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort}>Conjunto</ResizableHead>
                      <ResizableHead colKey="campaign" width={ad.colWidths.campaign} onResize={ad.startResize("campaign")} sortable sortableKey="campaign" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort}>Campanha</ResizableHead>
                      <ResizableHead colKey="spend" width={ad.colWidths.spend} onResize={ad.startResize("spend")} sortable sortableKey="spend" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Gastos</ResizableHead>
                      <ResizableHead colKey="impressions" width={ad.colWidths.impressions} onResize={ad.startResize("impressions")} sortable sortableKey="impressions" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Impressões</ResizableHead>
                      <ResizableHead colKey="cpm" width={ad.colWidths.cpm} onResize={ad.startResize("cpm")} sortable sortableKey="cpm" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">CPM</ResizableHead>
                      <ResizableHead colKey="reach" width={ad.colWidths.reach} onResize={ad.startResize("reach")} sortable sortableKey="reach" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Alcance*</ResizableHead>
                      <ResizableHead colKey="frequency" width={ad.colWidths.frequency} onResize={ad.startResize("frequency")} sortable sortableKey="frequency" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Frequência*</ResizableHead>
                      <ResizableHead colKey="clicks" width={ad.colWidths.clicks} onResize={ad.startResize("clicks")} sortable sortableKey="clicks" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Cliques</ResizableHead>
                      <ResizableHead colKey="ctr" width={ad.colWidths.ctr} onResize={ad.startResize("ctr")} sortable sortableKey="ctr" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">CTR</ResizableHead>
                      <ResizableHead colKey="cpc" width={ad.colWidths.cpc} onResize={ad.startResize("cpc")} sortable sortableKey="cpc" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">CPC</ResizableHead>
                      <ResizableHead colKey="leads" width={ad.colWidths.leads} onResize={ad.startResize("leads")} sortable sortableKey="leads" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Leads</ResizableHead>
                      <ResizableHead colKey="cpl" width={ad.colWidths.cpl} onResize={ad.startResize("cpl")} sortable sortableKey="cpl" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">CPL</ResizableHead>
                      <ResizableHead colKey="sales" width={ad.colWidths.sales} onResize={ad.startResize("sales")} sortable sortableKey="sales" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Vendas</ResizableHead>
                      <ResizableHead colKey="revenue" width={ad.colWidths.revenue} onResize={ad.startResize("revenue")} sortable sortableKey="revenue" sortKey={adSortKey} sortAsc={adSortAsc} onSort={handleAdSort} align="right">Valor da venda</ResizableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAds.map((a: any) => (
                      <TableRow key={a.id} className="h-12 cursor-pointer odd:bg-card even:bg-muted/20 hover:bg-primary/5" onClick={() => setDetailEntity({ ...a, type: "ad" })}>
                        <TableCell style={adCellW("name")} className="font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            {a.thumbnail_url ? (
                              <img src={a.thumbnail_url} alt="" className="h-8 w-8 rounded object-cover border flex-shrink-0" loading="lazy" />
                            ) : (
                              <div className="h-8 w-8 rounded bg-muted border flex-shrink-0" />
                            )}
                            <StatusDot status={a.status} />
                            <span className="truncate" title={a.name}>{a.name}</span>
                            <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 shrink-0" onClick={(event) => { event.stopPropagation(); setEditingEntity({ type: "ad", id: a.id, name: a.name, status: a.status }); }} title="Editar anúncio na Meta Ads">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell style={adCellW("adset")} className="text-muted-foreground text-sm truncate" title={a.adsetName}>{a.adsetName}</TableCell>
                        <TableCell style={adCellW("campaign")} className="text-muted-foreground text-sm truncate" title={a.campaignName}>{a.campaignName}</TableCell>
                        <TableCell style={adCellW("spend")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.spend} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adCellW("impressions")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions} decimals={0} /></TableCell>
                        <TableCell style={adCellW("cpm")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions > 0 ? a.spend / a.impressions * 1000 : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adCellW("reach")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.reach} decimals={0} /></TableCell>
                        <TableCell style={adCellW("frequency")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.reach > 0 ? a.impressions / a.reach : 0} decimals={2} /></TableCell>
                        <TableCell style={adCellW("clicks")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.clicks} decimals={0} /></TableCell>
                        <TableCell style={adCellW("ctr")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0} suffix="%" decimals={2} /></TableCell>
                        <TableCell style={adCellW("cpc")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.clicks > 0 ? a.spend / a.clicks : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adCellW("leads")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads} decimals={0} /></TableCell>
                        <TableCell style={adCellW("cpl")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.leads > 0 ? a.spend / a.leads : 0} prefix="R$ " decimals={2} /></TableCell>
                        <TableCell style={adCellW("sales")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.sales} decimals={0} /></TableCell>
                        <TableCell style={adCellW("revenue")} className="text-right tabular-nums text-sm"><AnimatedNumber value={a.revenue} prefix="R$ " decimals={2} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <LevelTotals label="anúncios" count={selectedAds.length} totals={adTotals} />
              </>}
            </Card>
          </TabsContent>
        </Tabs>
      </MotionItem>

      <CampaignDetailSheet
        open={!!detailCampaignId}
        onOpenChange={(v) => !v && setDetailCampaignId(null)}
        campaign={detailCampaignId ? (campaigns.find((c: any) => c.id === detailCampaignId) || null) : null}
        startDate={startDate}
        endDate={endDate}
        onEdit={(campaign) => { setDetailCampaignId(null); setEditingEntity({ type: "campaign", id: campaign.id, name: campaign.name, status: campaign.status, dailyBudget: (campaign as any).daily_budget ?? (campaign as any).budget }); }}
        onViewAds={(campaign) => { setSelectedIds(new Set([campaign.id])); setActiveTab("ads"); setDetailCampaignId(null); }}
      />
      <MetaEntityDetailSheet
        entity={detailEntity}
        open={!!detailEntity}
        onOpenChange={(open) => !open && setDetailEntity(null)}
        onEdit={(entity) => {
          setDetailEntity(null);
          setEditingEntity({ type: entity.type, id: entity.id, name: entity.name, status: entity.status, dailyBudget: entity.type === "adset" ? entity.daily_budget : undefined });
        }}
        onViewAds={(entity) => {
          setSelectedIds(new Set([entity.campaignId]));
          setActiveTab("ads");
          setDetailEntity(null);
        }}
      />
      <MetaEntityEditor
        entity={editingEntity}
        onOpenChange={(open) => !open && setEditingEntity(null)}
        onSaved={async () => { await refetch(); }}
      />
      <MetaCampaignCreator
        open={createCampaignOpen}
        accounts={visibleAdAccounts.map((account) => ({ id: account.id, name: account.name }))}
        defaultAccountId={selectedAccount !== "all" ? selectedAccount : undefined}
        onOpenChange={setCreateCampaignOpen}
        onCreated={async () => { await refetch(); }}
      />
      <MetaCampaignDuplicator
        campaign={duplicatingCampaign}
        onOpenChange={(open) => { if (!open) setDuplicatingCampaign(null); }}
        onDuplicated={async (duplicate) => {
          await refetch();
          setSelectedIds(new Set([duplicate.id]));
          setEditingEntity({ type: "campaign", id: duplicate.id, name: duplicate.name, status: duplicate.status });
        }}
      />
    </MotionPage>
  );
}

function CampaignIntelligence({ totals, totalCtr, totalCpc, totalCpm, totalCpl, totalRoas, totalResultRate, series, campaigns, adsets, ads, accountId, accountName, startDate, endDate, selectedCampaignIds }: {
  totals: any;
  totalCtr: number;
  totalCpc: number;
  totalCpm: number;
  totalCpl: number;
  totalRoas: number;
  totalResultRate: number;
  series: any[];
  campaigns: any[];
  adsets: any[];
  ads: any[];
  accountId: string;
  accountName?: string;
  startDate: Date;
  endDate: Date;
  selectedCampaignIds: string[];
}) {
  const [view, setView] = useState<"overview" | "metrics" | "campaigns" | "adsets" | "creatives" | "actions">("overview");
  const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const tooltipStyle = { borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", fontSize: 11 };
  const safeSeries = useMemo(() => {
    if (series.length > 0) return series;
    const emptyPoint = (date: Date) => ({
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      spend: 0,
      leads: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      resultRate: 0,
      cpc: 0,
      cpl: 0,
      cpm: 0,
    });
    const start = emptyPoint(startDate);
    return startDate.toDateString() === endDate.toDateString() ? [start] : [start, emptyPoint(endDate)];
  }, [endDate, series, startDate]);
  const views = [
    { id: "overview", label: "Visão geral" },
    { id: "metrics", label: "Métricas" },
    { id: "campaigns", label: `Campanhas (${campaigns.length})` },
    { id: "adsets", label: `Conjuntos (${adsets.length})` },
    { id: "creatives", label: `Criativos (${ads.length})` },
    { id: "actions", label: "IA e ações" },
  ] as const;
  const showMetrics = view === "overview" || view === "metrics";
  const daysWithData = useMemo(() => series.filter((item) => item.hasData).length, [series]);
  return (
    <section className="campaign-analysis-shell border-b border-primary/20" data-analysis-content="intelligence">
      <header className="campaign-analysis-header flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black"><BrainCircuit className="h-4 w-4 text-primary" />Growdash Intelligence</h2>
          <p className="text-[10px] text-muted-foreground">Diagnóstico quantitativo da entrega, eficiência e resultado no período selecionado.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/inteligencia" className="gd-button h-8 px-3 text-[10px]"><Sparkles className="h-3.5 w-3.5" />10 automações IA</a>
          <Badge variant="outline" className="w-fit">{daysWithData} de {series.length} dia(s) com dados</Badge>
        </div>
      </header>

      <nav className="flex max-w-full gap-1 overflow-x-auto border-b border-border bg-muted/20 p-2 growdash-scrollbar-hidden" aria-label="Análises de tráfego pago">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={cn(
              "min-h-9 shrink-0 rounded-lg border px-3 text-[10px] font-black transition",
              view === item.id ? "border-primary/55 bg-primary text-primary-foreground shadow-[0_0_20px_rgba(213,166,42,.16)]" : "border-transparent text-muted-foreground hover:border-border hover:bg-background hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {showMetrics && <>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnalysisMetric label="Impressões" value={Number(totals.impressions || 0).toLocaleString("pt-BR")} />
        <AnalysisMetric label="CTR" value={`${Number(totalCtr || 0).toFixed(2).replace(".", ",")}%`} />
        <AnalysisMetric label="Investimento" value={currency(Number(totals.spend || 0))} />
        <AnalysisMetric
          label="Leads de aquisição"
          value={Number(totals.leads || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          description={`${Number(totals.formLeads || 0).toLocaleString("pt-BR")} leads em formulário/site + ${Number(totals.conversations || 0).toLocaleString("pt-BR")} conversas iniciadas.`}
        />
        <AnalysisMetric label="CPL" value={currency(Number(totalCpl || 0))} />
        <AnalysisMetric label="ROAS" value={`${Number(totalRoas || 0).toFixed(2).replace(".", ",")}x`} />
        <AnalysisMetric label="CPM" value={currency(Number(totalCpm || 0))} />
        <AnalysisMetric label="Cliques" value={Number(totals.clicks || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} />
        <AnalysisMetric label="CPC" value={currency(Number(totalCpc || 0))} />
        <AnalysisMetric label="Taxa de resultado" value={`${Number(totalResultRate || 0).toFixed(2).replace(".", ",")}%`} />
      </div>

        <div className="relative grid gap-3 border-t border-border p-3 xl:grid-cols-2">
          {daysWithData === 0 && <span className="absolute right-5 top-5 z-10 rounded-full border border-border bg-background/90 px-2 py-1 text-[9px] font-bold text-muted-foreground">Sem dados no período · exibindo todos os dias zerados</span>}
          <ChartPanel title="Investimento × leads de aquisição" description="Formulários, site e conversas iniciadas por dia, com duas escalas para não distorcer volume e custo.">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={safeSeries} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="money" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "Investimento" ? currency(value) : Number(value).toLocaleString("pt-BR"), name]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="money" dataKey="spend" name="Investimento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="volume" type="monotone" dataKey="leads" name="Leads de aquisição" stroke="hsl(var(--success))" strokeWidth={2.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>
          <ChartPanel title="Eficiência de mídia" description="CTR, taxa de resultado, CPC e CPL por dia.">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={safeSeries} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "CTR" || name === "Taxa de resultado" ? `${Number(value).toFixed(2)}%` : currency(Number(value)), name]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="ctr" name="CTR" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resultRate" name="Taxa de resultado" stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cpc" name="CPC" stroke="var(--brand-gold-light)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cpl" name="CPL" stroke="#fb7185" strokeWidth={2} dot={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      </>}

      {view === "campaigns" && <EntityIntelligenceTable title="Desempenho por campanha" nameLabel="Campanha" entities={campaigns} />}
      {view === "adsets" && <EntityIntelligenceTable title="Desempenho por conjunto de anúncios" nameLabel="Conjunto de anúncios" entities={adsets} />}
      {view === "creatives" && <><CreativeIntelligenceGallery ads={ads} /><EntityIntelligenceTable title="Desempenho por criativo" nameLabel="Criativo" entities={ads} /></>}

      {view === "actions" && <div className="border-t border-border">
        <TrafficAIAnalysis accountId={accountId} accountName={accountName} startDate={startDate} endDate={endDate} selectedCampaignIds={selectedCampaignIds} />
      </div>}

      {view === "overview" && <div className="border-t border-border bg-muted/10 px-4 py-3 text-[10px] text-muted-foreground">
        Use as abas para comparar métricas, campanhas, conjuntos e criativos sem sair do gerenciador. Os filtros de conta, campanha e período permanecem aplicados.
      </div>}
    </section>
  );
}

type CreativeSort = "leads" | "cpl" | "ctr" | "clicks" | "conversion" | "spend";

function CreativeIntelligenceGallery({ ads }: { ads: any[] }) {
  const [sortBy, setSortBy] = useState<CreativeSort>("leads");
  const creatives = useMemo(() => ads.map((ad) => ({
    ...ad,
    mediaUrl: ad.thumbnail_url || ad.media_url || ad.video_url || null,
    spend: Number(ad.spend || 0),
    leads: Number(ad.leads || 0),
    resultLabel: ad.resultLabel || "Resultados",
    clicks: Number(ad.clicks || ad.linkClicks || 0),
    ctr: Number(ad.ctr || 0),
    cpl: Number(ad.leads || 0) > 0 ? Number(ad.spend || 0) / Number(ad.leads || 0) : 0,
    conversion: Number(ad.clicks || ad.linkClicks || 0) > 0 ? Number(ad.leads || 0) / Number(ad.clicks || ad.linkClicks || 0) * 100 : 0,
  })).sort((a, b) => {
    if (sortBy === "cpl") {
      if (a.leads === 0 && b.leads === 0) return b.spend - a.spend;
      if (a.leads === 0) return 1;
      if (b.leads === 0) return -1;
      return a.cpl - b.cpl;
    }
    return Number(b[sortBy] || 0) - Number(a[sortBy] || 0);
  }), [ads, sortBy]);

  return <section className="border-t border-border p-3">
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h3 className="text-xs font-black">Galeria de criativos</h3><p className="mt-1 text-[9px] text-muted-foreground">Compare as peças pelo resultado real dentro do período e dos filtros selecionados.</p></div>
      <label className="grid gap-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground"><span>Ordenar criativos</span><Select value={sortBy} onValueChange={(value) => setSortBy(value as CreativeSort)}><SelectTrigger className="h-9 min-w-52 bg-background text-xs normal-case tracking-normal text-foreground"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="leads">Mais resultados</SelectItem><SelectItem value="cpl">Menor custo por resultado</SelectItem><SelectItem value="ctr">Maior CTR</SelectItem><SelectItem value="clicks">Mais cliques</SelectItem><SelectItem value="conversion">Maior conversão</SelectItem><SelectItem value="spend">Maior investimento</SelectItem></SelectContent></Select></label>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {creatives.length > 0 ? creatives.map((ad) => {
        return <article key={ad.id} className="overflow-hidden rounded-xl border border-border bg-background">
          <CreativeMediaPreview mediaUrl={ad.mediaUrl} name={ad.name} />
          <div className="p-3"><div className="flex items-center justify-between gap-2"><h4 className="truncate text-[11px] font-black" title={ad.name || "Sem nome"}>{ad.name || "Sem nome"}</h4><Badge variant="outline" className="shrink-0 text-[8px]">{ad.leads > 0 ? `${ad.leads.toLocaleString("pt-BR")} ${ad.resultLabel.toLocaleLowerCase()}` : "Sem resultado"}</Badge></div><p className="mt-1 truncate text-[9px] text-muted-foreground">{ad.campaignName || "Campanha não identificada"}</p><div className="mt-3 grid grid-cols-3 gap-2"><IssueMetric label={ad.resultLabel} value={ad.leads.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} /><IssueMetric label="Custo/result." value={ad.leads > 0 ? ad.cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"} /><IssueMetric label="Conversão" value={`${ad.conversion.toFixed(2).replace(".", ",")}%`} /><IssueMetric label="Cliques" value={ad.clicks.toLocaleString("pt-BR")} /><IssueMetric label="CTR" value={`${ad.ctr.toFixed(2).replace(".", ",")}%`} /><IssueMetric label="Investido" value={ad.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /></div></div>
        </article>;
      }) : <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">Nenhum criativo sincronizado para os filtros atuais.</div>}
    </div>
  </section>;
}

function CreativeMediaPreview({ mediaUrl, name }: { mediaUrl: string | null; name?: string }) {
  const [failed, setFailed] = useState(false);
  const isVideo = typeof mediaUrl === "string" && /\.(mp4|webm|mov|m4v)(?:\?|$)/i.test(mediaUrl);
  if (!mediaUrl || failed) return <div className="grid aspect-video place-items-center bg-black px-4 text-center text-[10px] text-white/55"><span><RectangleHorizontal className="mx-auto mb-2 h-7 w-7" />{failed ? "Prévia expirada — sincronize a Meta novamente" : "Prévia ainda não sincronizada"}</span></div>;
  return <div className="grid aspect-video place-items-center overflow-hidden bg-black">{isVideo
    ? <video src={mediaUrl} controls preload="metadata" className="h-full w-full object-contain" aria-label={`Vídeo do criativo ${name || "sem nome"}`} onError={() => setFailed(true)} />
    : <img src={mediaUrl} alt={`Criativo ${name || "sem nome"}`} loading="lazy" className="h-full w-full object-contain" onError={() => setFailed(true)} />}</div>;
}

function EntityIntelligenceTable({ title, nameLabel, entities }: { title: string; nameLabel: string; entities: any[] }) {
  const rows = useMemo(() => [...entities]
    .map((entity) => ({
      id: entity.id,
      name: entity.name || "Sem nome",
      status: normalizeStatus(entity.status),
      spend: Number(entity.spend || 0),
      impressions: Number(entity.impressions || 0),
      clicks: Number(entity.clicks || entity.linkClicks || 0),
      leads: Number(entity.leads || entity.results || 0),
      ctr: Number(entity.ctr || 0),
      cpl: Number(entity.cpl || 0),
    }))
    .sort((a, b) => b.spend - a.spend), [entities]);
  const totals = useMemo(() => rows.reduce((acc, row) => ({
    spend: acc.spend + row.spend,
    impressions: acc.impressions + row.impressions,
    clicks: acc.clicks + row.clicks,
    leads: acc.leads + row.leads,
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0 }), [rows]);
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return <div className="border-t border-border p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-xs font-black">{title}</h3><p className="mt-1 text-[9px] text-muted-foreground">Ordenado por investimento no período selecionado.</p></div>
      <Badge variant="outline">{rows.length} item(ns)</Badge>
    </div>
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[820px] text-left text-[10px]">
        <thead className="bg-muted/70 text-muted-foreground"><tr><th className="px-3 py-2">{nameLabel}</th><th className="px-3 py-2">Veiculação</th><th className="px-3 py-2 text-right">Investimento</th><th className="px-3 py-2 text-right">Impressões</th><th className="px-3 py-2 text-right">Cliques</th><th className="px-3 py-2 text-right">CTR</th><th className="px-3 py-2 text-right">Leads</th><th className="px-3 py-2 text-right">CPL</th></tr></thead>
        <tbody className="divide-y divide-border">
          {rows.length > 0 ? rows.map((row) => <tr key={row.id} className="hover:bg-muted/25"><td className="max-w-[320px] truncate px-3 py-2 font-bold">{row.name}</td><td className="px-3 py-2"><span className={cn("inline-flex items-center gap-1 font-bold", row.status === "active" ? "text-emerald-500" : "text-muted-foreground")}><span className={cn("h-2 w-2 rounded-full", row.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/50")} />{row.status === "active" ? "Ativo" : "Desativado"}</span></td><td className="px-3 py-2 text-right tabular-nums">{money(row.spend)}</td><td className="px-3 py-2 text-right tabular-nums">{row.impressions.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{row.clicks.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{row.ctr.toFixed(2).replace(".", ",")}%</td><td className="px-3 py-2 text-right tabular-nums">{row.leads.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td><td className="px-3 py-2 text-right tabular-nums">{money(row.cpl)}</td></tr>) : <tr><td colSpan={8} className="h-28 px-4 text-center text-muted-foreground">Nenhum dado neste nível. A tabela e os indicadores permanecem disponíveis e serão preenchidos após a sincronização.</td></tr>}
        </tbody>
        <tfoot className="border-t border-border bg-muted/50 font-black"><tr><td className="px-3 py-2" colSpan={2}>Resultados de {rows.length} {nameLabel.toLowerCase()}(s)</td><td className="px-3 py-2 text-right tabular-nums">{money(totals.spend)}</td><td className="px-3 py-2 text-right tabular-nums">{totals.impressions.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right tabular-nums">{totals.clicks.toLocaleString("pt-BR")}</td><td className="px-3 py-2 text-right">—</td><td className="px-3 py-2 text-right tabular-nums">{totals.leads.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td><td className="px-3 py-2 text-right tabular-nums">{money(totals.leads > 0 ? totals.spend / totals.leads : 0)}</td></tr></tfoot>
      </table>
    </div>
  </div>;
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <article className="campaign-analysis-card min-w-0 p-4"><h3 className="text-xs font-black">{title}</h3><p className="mt-1 text-[9px] text-muted-foreground">{description}</p><div className="mt-4 h-[260px] min-w-0">{children}</div></article>;
}

function CampaignResultCell({ campaign, onOpen }: { campaign: any; onOpen: () => void }) {
  const primary = campaignPrimaryResult(campaign);
  const breakdown = campaign.results?.breakdown ?? (Number(campaign.leads || 0) > 0 ? [{ label: "Leads Meta", value: Number(campaign.leads) }] : []);
  const events = (campaign.actionEvents ?? []).slice(0, 8);
  return <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="ml-auto block rounded-md px-1 py-0.5 text-right transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={onOpen} aria-label={`Abrir resultado e eventos de ${campaign.name}`}>
        <AnimatedNumber value={primary.value} decimals={0} />
        <span className="block text-[11px] font-medium leading-tight text-muted-foreground">{primary.value > 0 ? primary.label : "Sem resultado no período"}</span>
      </button>
    </TooltipTrigger>
    <TooltipContent side="left" align="end" className="campaign-result-tooltip max-w-80 border-primary/25 bg-popover p-3 text-popover-foreground shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-wider text-primary">Resultados da campanha</p>
      <p className="mt-1 text-xs font-bold">{primary.value.toLocaleString("pt-BR")} {primary.label.toLocaleLowerCase()} no período</p>
      {breakdown.length > 0 ? <div className="mt-2 space-y-1 border-t border-border pt-2 text-[11px]">{breakdown.map((item: any) => <div key={item.label} className="flex justify-between gap-4"><span className="text-muted-foreground">{item.label}</span><b>{Number(item.value).toLocaleString("pt-BR")}</b></div>)}</div> : <p className="mt-2 text-[11px] text-muted-foreground">A Meta não registrou leads nem conversas iniciadas neste período.</p>}
      {events.length > 0 ? <div className="mt-3 border-t border-border pt-2"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Eventos sincronizados</p><div className="mt-1 space-y-1 text-[11px]">{events.map((event: any) => <div key={event.actionType} className="flex justify-between gap-4"><span className="truncate" title={friendlyActionLabel(event.actionType)}>{friendlyActionLabel(event.actionType)}</span><b>{Number(event.value).toLocaleString("pt-BR")}</b></div>)}</div></div> : null}
      <p className="mt-3 text-[10px] text-muted-foreground">Clique para abrir o detalhamento completo.</p>
    </TooltipContent>
  </Tooltip>;
}

function CampaignTotalCell({ width, value, label, align = "right", stickyLeft, strongDivider = false }: { width: number; value?: string; label?: string; align?: "left" | "right"; stickyLeft?: number; strongDivider?: boolean }) {
  return <TableCell
    style={{ width, minWidth: width, maxWidth: width, ...(stickyLeft !== undefined ? { left: stickyLeft } : {}) }}
    className={cn(
      "border-r border-border/70 bg-card tabular-nums dark:border-[#2a271f] dark:bg-[#070706]",
      align === "right" ? "text-right" : "text-left",
      stickyLeft !== undefined && "sticky z-50",
      strongDivider && "border-r border-border shadow-[8px_0_14px_-14px_rgba(0,0,0,.9)] dark:border-[#28251e]",
    )}
  >
    {value && <strong className="block truncate text-sm font-semibold text-foreground">{value}</strong>}
    {label && <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-muted-foreground">{label}</span>}
  </TableCell>;
}

function CampaignTotalsRow({ widths, visibleColumns, count, totals, totalCpm, totalCpl, totalCpc, totalCtr, totalRoas, totalLinkCpc, totalUniqueLinkCtr, totalCostPerLandingPageView, totalCostPerCheckout, totalMetaCostPerPurchase, totalMetaPurchaseRoas, totalResultRate }: any) {
  const show = (key: CampaignColumnKey) => visibleColumns.has(key);
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const decimal = (value: number, suffix = "") => `${value.toFixed(2).replace(".", ",")}${suffix}`;
  return <TableRow data-campaign-totals className="h-16 border-0 bg-card hover:bg-card dark:border-[#2a271f] dark:bg-[#070706] dark:hover:bg-[#070706] [&>td]:px-3 [&>td]:py-1">
    <CampaignTotalCell width={widths.check} stickyLeft={0} /><CampaignTotalCell width={widths.delivery} stickyLeft={widths.check} /><CampaignTotalCell width={widths.name} value={`Resultados de ${count} campanhas`} label="Totais do período e filtros selecionados" align="left" stickyLeft={widths.check + widths.delivery} strongDivider />
    {show("deliveryStatus") && <CampaignTotalCell width={widths.deliveryStatus} value="—" />}{show("actions") && <CampaignTotalCell width={widths.actions} value="—" />}{show("reach") && <CampaignTotalCell width={widths.reach} value={totals.reach.toLocaleString("pt-BR")} label="Total" />}{show("impressions") && <CampaignTotalCell width={widths.impressions} value={totals.impressions.toLocaleString("pt-BR")} label="Total" />}{show("frequency") && <CampaignTotalCell width={widths.frequency} value={totals.reach ? decimal(totals.impressions / totals.reach) : "0,00"} label="Média" />}{show("linkClicks") && <CampaignTotalCell width={widths.linkClicks} value={totals.linkClicks.toLocaleString("pt-BR")} label="Total" />}{show("linkCpc") && <CampaignTotalCell width={widths.linkCpc} value={money(totalLinkCpc)} label="Por clique no link" />}{show("uniqueLinkCtr") && <CampaignTotalCell width={widths.uniqueLinkCtr} value={decimal(totalUniqueLinkCtr, "%")} label="Taxa total" />}{show("cpm") && <CampaignTotalCell width={widths.cpm} value={money(totalCpm)} label="Por 1.000 impressões" />}{show("budget") && <CampaignTotalCell width={widths.budget} value={money(totals.budget)} label="Orçamento somado" />}
    {show("leads") && <CampaignTotalCell width={widths.leads} value={totals.results.toLocaleString("pt-BR")} label={`${totals.conversations.toLocaleString("pt-BR")} conversas · ${totals.formLeads.toLocaleString("pt-BR")} forms/site`} />}{show("cpl") && <CampaignTotalCell width={widths.cpl} value={money(totalCpl)} label="Por resultado" />}{show("spend") && <CampaignTotalCell width={widths.spend} value={money(totals.spend)} label="Total usado" />}{show("landingPageViews") && <CampaignTotalCell width={widths.landingPageViews} value={totals.landingPageViews.toLocaleString("pt-BR")} label="Total" />}{show("costPerLandingPageView") && <CampaignTotalCell width={widths.costPerLandingPageView} value={money(totalCostPerLandingPageView)} label="Por visualização" />}{show("checkouts") && <CampaignTotalCell width={widths.checkouts} value={totals.checkouts.toLocaleString("pt-BR")} label="Total" />}{show("costPerCheckout") && <CampaignTotalCell width={widths.costPerCheckout} value={money(totalCostPerCheckout)} label="Por finalização" />}{show("metaPurchases") && <CampaignTotalCell width={widths.metaPurchases} value={totals.metaPurchases.toLocaleString("pt-BR")} label="Total" />}{show("metaCostPerPurchase") && <CampaignTotalCell width={widths.metaCostPerPurchase} value={money(totalMetaCostPerPurchase)} label="Por compra" />}{show("metaPurchaseRoas") && <CampaignTotalCell width={widths.metaPurchaseRoas} value={decimal(totalMetaPurchaseRoas, "x")} label="Retorno total" />}
    {show("objective") && <CampaignTotalCell width={widths.objective} value="—" />}{show("clicks") && <CampaignTotalCell width={widths.clicks} value={totals.clicks.toLocaleString("pt-BR")} label="Total" />}{show("cpc") && <CampaignTotalCell width={widths.cpc} value={money(totalCpc)} label="Por clique" />}{show("ctr") && <CampaignTotalCell width={widths.ctr} value={decimal(totalCtr, "%")} label="Taxa total" />}{show("conversion") && <CampaignTotalCell width={widths.conversion} value={decimal(totalResultRate, "%")} label="Taxa total" />}{show("sales") && <CampaignTotalCell width={widths.sales} value={totals.salesCount.toLocaleString("pt-BR")} label="Total" />}{show("cpa") && <CampaignTotalCell width={widths.cpa} value={money(totals.salesCount ? totals.spend / totals.salesCount : 0)} label="Por venda" />}{show("revenue") && <CampaignTotalCell width={widths.revenue} value={money(totals.revenue)} label="Valor total" />}{show("roas") && <CampaignTotalCell width={widths.roas} value={decimal(totalRoas, "x")} label="Retorno total" />}{show("profit") && <CampaignTotalCell width={widths.profit} value={money(totals.profit)} label="Total" />}{show("roi") && <CampaignTotalCell width={widths.roi} value={decimal(totals.spend ? totals.profit / totals.spend * 100 : 0, "%")} label="Retorno total" />}{show("videoViews") && <CampaignTotalCell width={widths.videoViews} value="—" label="Não sincronizado" />}
  </TableRow>;
}

function TotalMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[118px] shrink-0 rounded-lg border border-border/70 bg-muted/35 px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-0.5 block whitespace-nowrap text-xs tabular-nums">{value}</strong></div>;
}

function AnalysisMetric({ label, value, description }: { label: string; value: string; description?: string }) {
  return <div className="campaign-analysis-card px-3 py-2" title={description}><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-1 block text-sm tabular-nums">{value}</strong></div>;
}

function AnalysisCampaignAlert({ campaign, health, targetCpl, accountName, onOpen }: { campaign: any; health: CampaignHealth; targetCpl: number; accountName: string; onOpen: () => void }) {
  const option = HEALTH_OPTIONS.find((item) => item.id === health)!;
  const primary = campaignPrimaryResult(campaign);
  const days = getCampaignActiveDays(campaign.created_at);
  return (
    <button type="button" onClick={onOpen} className="campaign-analysis-card p-3 text-left hover:bg-primary/[0.025] hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", option.dot)} /><span className="text-[9px] font-black uppercase tracking-wider">{option.label}</span></div>
          <h4 className="mt-2 truncate text-sm font-black">{campaign.name}</h4>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">BM: {accountName} · Alvo CPL: {targetCpl > 0 ? targetCpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "não definido"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[9px] text-muted-foreground">{Number.isFinite(days) ? `${days.toFixed(1)}d ativa` : "idade indisponível"}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <IssueMetric label="Investido" value={campaign.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <IssueMetric label={primary.label} value={primary.value.toLocaleString("pt-BR")} />
        <IssueMetric label="Custo/resultado" value={(campaign.costPerResult ?? campaign.cpl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
        <IssueMetric label="CTR" value={`${campaign.ctr.toFixed(2).replace(".", ",")}%`} />
      </div>
    </button>
  );
}

function IssueMetric({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-1 block tabular-nums">{value}</strong></div>;
}

function CampaignMobileCard({ campaign, selected, health, onSelect, onOpen, onEdit }: { campaign: any; selected: boolean; health: CampaignHealth; onSelect: () => void; onOpen: () => void; onEdit: () => void }) {
  const healthOption = HEALTH_OPTIONS.find((item) => item.id === health)!;
  const primary = campaignPrimaryResult(campaign);
  return <article className={cn("rounded-xl border bg-card p-3", selected ? "border-primary bg-primary/5" : "border-border")}><div className="flex items-start gap-3"><Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Selecionar ${campaign.name}`} /><button type="button" onClick={onOpen} className="min-w-0 grow text-left"><span className="block truncate text-sm font-black">{campaign.name}</span><span className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", healthOption.dot)} />{healthOption.label} · {getStatusBadge(campaign.status).label}</span></button><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onEdit}><Pencil className="h-4 w-4" /></Button></div><button type="button" onClick={onOpen} className="mt-3 grid w-full grid-cols-2 gap-2 text-left"><IssueMetric label="Investimento" value={campaign.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><IssueMetric label={primary.label} value={primary.value.toLocaleString("pt-BR")} /><IssueMetric label="Custo / resultado" value={(campaign.costPerResult ?? campaign.cpl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><IssueMetric label="CTR" value={`${campaign.ctr.toFixed(2).replace(".", ",")}%`} /></button></article>;
}

function LevelMobileCard({ entity, onOpen }: { entity: MetaDetailEntity; onOpen: () => void }) {
  const cpl = entity.leads > 0 ? entity.spend / entity.leads : 0;
  return <button type="button" onClick={onOpen} className="w-full rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block truncate text-sm font-black">{entity.name}</span><span className="mt-1 block truncate text-[9px] text-muted-foreground">{entity.adsetName ? `${entity.adsetName} · ` : ""}{entity.campaignName}</span></div><Badge variant="outline">{normalizeStatus(entity.status) === "ACTIVE" ? "Ativo" : "Pausado"}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2"><IssueMetric label="Investimento" value={entity.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><IssueMetric label="Impressões" value={entity.impressions.toLocaleString("pt-BR")} /><IssueMetric label="Resultados" value={entity.leads.toLocaleString("pt-BR")} /><IssueMetric label="CPL" value={cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /></div></button>;
}

function LevelLoading() {
  return <div className="space-y-2 p-3" aria-label="Carregando dados da Meta Ads">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />)}</div>;
}

function LevelEmpty({ level, selected, onClear }: { level: string; selected: boolean; onClear: () => void }) {
  return <div className="grid min-h-52 place-items-center p-6 text-center"><div><Layers3 className="mx-auto h-10 w-10 text-muted-foreground" /><h3 className="mt-3 font-black">Nenhum {level} encontrado</h3><p className="mt-1 text-xs text-muted-foreground">{selected ? "A seleção ou os filtros atuais não possuem resultados neste nível." : "Sincronize a conta Meta ou ajuste os filtros do período."}</p>{selected && <Button variant="outline" size="sm" className="mt-4" onClick={onClear}><X className="mr-2 h-4 w-4" />Limpar filtro de campanha</Button>}</div></div>;
}

function aggregateLevelTotals(rows: Array<{ spend: number; impressions: number; reach: number; clicks: number; leads: number }>) {
  return rows.reduce((total, row) => ({ spend: total.spend + row.spend, impressions: total.impressions + row.impressions, reach: total.reach + row.reach, clicks: total.clicks + row.clicks, leads: total.leads + row.leads }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0 });
}

function LevelTotals({ label, count, totals }: { label: string; count: number; totals: ReturnType<typeof aggregateLevelTotals> }) {
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  return <div className="campaign-total-bar sticky bottom-0 z-30 shrink-0 border-b border-white/[.08] px-3 py-3"><div className="growdash-scrollbar flex gap-2 overflow-x-auto"><TotalMetric label="Totais" value={`Totais (${count})`} /><TotalMetric label="Investimento" value={totals.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><TotalMetric label="Impressões" value={totals.impressions.toLocaleString("pt-BR")} /><TotalMetric label="Alcance*" value={totals.reach.toLocaleString("pt-BR")} /><TotalMetric label="Cliques" value={totals.clicks.toLocaleString("pt-BR")} /><TotalMetric label="CTR" value={`${ctr.toFixed(2).replace(".", ",")}%`} /><TotalMetric label="Resultados" value={totals.leads.toLocaleString("pt-BR")} /><TotalMetric label="CPL" value={cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /></div></div>;
}

function BreakdownWorkspace({ label, supported, loading, rows, onSync }: { label: string; supported: boolean; loading: boolean; rows: Array<{ key: string; spend: number; impressions: number; clicks: number; leads: number; ctr: number; cpl: number }>; onSync: () => void }) {
  if (!supported) return <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/20 px-3 py-2 text-[11px]"><Layers3 className="h-4 w-4 text-primary" /><span><b>{label}</b> está disponível como opção de análise, mas a Meta não disponibiliza este recorte de forma confiável para todas as contas via API. Nenhum dado é estimado.</span>{label === "Criativo" && <span className="ml-auto text-primary">Use a aba Anúncios para analisar por criativo.</span>}</div>;
  return <section className="border-b border-border bg-primary/[.035] px-3 py-3" aria-label={`Detalhamento por ${label}`}><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xs font-black"><Layers3 className="h-4 w-4 text-primary" />Detalhamento por {label}</h2><p className="mt-1 text-[10px] text-muted-foreground">Recorte consolidado das campanhas e período atuais. Atualize somente quando precisar de dados novos.</p></div><Button variant="outline" size="sm" className="h-8 text-[10px]" disabled={loading} onClick={onSync}><RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{loading ? "Atualizando…" : "Atualizar recorte"}</Button></div>{rows.length ? <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[650px] text-xs"><thead className="bg-muted/45 text-[9px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-2.5 text-left">{label}</th><th className="p-2.5 text-right">Investimento</th><th className="p-2.5 text-right">Impressões</th><th className="p-2.5 text-right">Cliques</th><th className="p-2.5 text-right">CTR</th><th className="p-2.5 text-right">Resultados</th><th className="p-2.5 text-right">Custo / resultado</th></tr></thead><tbody className="divide-y divide-border">{rows.slice(0, 20).map((row) => <tr key={row.key}><td className="p-2.5 font-bold">{row.key}</td><td className="p-2.5 text-right tabular-nums">{row.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="p-2.5 text-right tabular-nums">{row.impressions.toLocaleString("pt-BR")}</td><td className="p-2.5 text-right tabular-nums">{row.clicks.toLocaleString("pt-BR")}</td><td className="p-2.5 text-right tabular-nums">{row.ctr.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td><td className="p-2.5 text-right tabular-nums">{row.leads.toLocaleString("pt-BR")}</td><td className="p-2.5 text-right tabular-nums">{row.cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground">Ainda não há dados de {label.toLocaleLowerCase("pt-BR")} para este período. Clique em “Atualizar recorte” para solicitar a leitura à Meta.</div>}</section>;
}
