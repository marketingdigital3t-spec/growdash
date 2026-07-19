import { useEffect, useState, useMemo } from "react";
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
  TriangleAlert,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BrainCircuit,
  Plus,
  Copy as CopyIcon,
  FlaskConical,
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
import { CampaignDetailSheet } from "@/components/campaigns/CampaignDetailSheet";
import { EditableMetaEntity, MetaEntityEditor } from "@/components/campaigns/MetaEntityEditor";
import { MetaCampaignCreator } from "@/components/campaigns/MetaCampaignCreator";
import { ResizableHead, StatusDot, normalizeStatus, useColWidths } from "@/components/dashboard/ResizableTableHelpers";
import { cn } from "@/lib/utils";
import { getStatusBadge } from "@/lib/status";
import { MetaTableControls } from "@/components/campaigns/MetaTableControls";
import { getBreakdownLabel, getMetaColumnPreset, type CampaignColumnKey, type MetaColumnPresetKey } from "@/lib/metaTableConfig";
import { TrafficAIAnalysis } from "@/components/campaigns/TrafficAIAnalysis";
import { MetaEntityDetailSheet, type MetaDetailEntity } from "@/components/campaigns/MetaEntityDetailSheet";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { pruneCampaignSelection, scopeCampaignHierarchy } from "@/lib/metaHierarchy";
import { getCampaignActiveDays, getCampaignHealth, type CampaignHealth } from "@/lib/campaignHealth";
import { useActionTotalsByAds } from "@/hooks/useActionTotalsByAds";
import { resolveMetaActionMetrics } from "@/lib/metaActionMetrics";

type CampSortKey = "status" | "name" | "objective" | "budget" | "salesCount" | "cpa" | "spend" | "leads" | "profit" | "roi" | "roas" | "revenue" | "cpl" | "ctr" | "cpc" | "cpm" | "conversionRate" | "clicks" | "impressions" | "reach" | "frequency" | "linkClicks" | "linkCpc" | "uniqueLinkCtr" | "landingPageViews" | "costPerLandingPageView" | "checkouts" | "costPerCheckout" | "metaPurchases" | "metaCostPerPurchase" | "metaPurchaseRoas";
type CampColKey = CampaignColumnKey;
type AdsetColKey = "name" | "campaign" | "budget" | "spend" | "leads" | "cpl" | "clicks" | "ctr" | "cpc" | "impressions" | "reach" | "frequency" | "cpm";
type AdColKey = "name" | "adset" | "campaign" | "spend" | "leads" | "cpl" | "clicks" | "ctr" | "cpc" | "impressions" | "reach" | "frequency" | "cpm";
const HEALTH_OPTIONS: Array<{ id: CampaignHealth; label: string; dot: string; active: string }> = [
  { id: "critical", label: "Crítico", dot: "bg-red-500", active: "border-red-500/55 bg-red-500/10 text-red-500" },
  { id: "warning", label: "Atenção", dot: "bg-amber-400", active: "border-amber-400/55 bg-amber-400/10 text-amber-500" },
  { id: "observation", label: "Observação", dot: "bg-orange-500", active: "border-orange-500/55 bg-orange-500/10 text-orange-500" },
  { id: "initial", label: "Estado inicial", dot: "bg-blue-500", active: "border-blue-500/55 bg-blue-500/10 text-blue-500" },
  { id: "healthy", label: "Saudável", dot: "bg-emerald-500", active: "border-emerald-500/55 bg-emerald-500/10 text-emerald-500" },
  { id: "inactive", label: "Inativas", dot: "bg-zinc-400", active: "border-zinc-400/55 bg-zinc-400/10 text-zinc-500" },
];

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
const ADSET_DEFAULTS: Record<AdsetColKey, number> = {
  name: 260, campaign: 220, budget: 130, spend: 120, leads: 90, cpl: 110, clicks: 100, ctr: 90,
  cpc: 100, impressions: 120, reach: 110, frequency: 100, cpm: 110,
};
const AD_DEFAULTS: Record<AdColKey, number> = {
  name: 260, adset: 200, campaign: 200, spend: 120, leads: 90, cpl: 110, clicks: 100, ctr: 100,
  cpc: 100, impressions: 120, reach: 110, frequency: 100, cpm: 110,
};

export default function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const syncMeta = useSyncMeta();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("campaigns");
  const [detailCampaignId, setDetailCampaignId] = useState<string | null>(null);
  const [detailEntity, setDetailEntity] = useState<MetaDetailEntity | null>(null);
  const [editingEntity, setEditingEntity] = useState<EditableMetaEntity | null>(null);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [sortKey, setSortKey] = useState<CampSortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [statusSortCycle, setStatusSortCycle] = useState<0 | 1 | 2>(0);
  const [columnPreset, setColumnPreset] = useState<MetaColumnPresetKey>("performance");
  const [visibleColumns, setVisibleColumns] = useState<Set<CampaignColumnKey>>(() => {
    try { const saved = JSON.parse(localStorage.getItem("growdash:meta-columns-v2") || "[]"); if (Array.isArray(saved) && saved.length) return new Set(saved); } catch { /* usa o preset padrão */ }
    return new Set(getMetaColumnPreset("performance").columns);
  });
  const [breakdown, setBreakdown] = useState(() => localStorage.getItem("growdash:meta-breakdown") || "none");
  const [campaignPage, setCampaignPage] = useState(0);
  const [healthFilter, setHealthFilter] = useState<CampaignHealth | "all">("all");
  const [analysisPanel, setAnalysisPanel] = useState<"alerts" | "intelligence" | null>(() => {
    const requested = searchParams.get("analise");
    return requested === "alerts" || requested === "intelligence" ? requested : null;
  });
  const pageSize = 50;

  useEffect(() => {
    localStorage.setItem("growdash:meta-columns-v2", JSON.stringify(Array.from(visibleColumns)));
    localStorage.setItem("growdash:meta-breakdown", breakdown);
  }, [visibleColumns, breakdown]);

  useEffect(() => {
    const requested = searchParams.get("analise");
    if (requested === "alerts" || requested === "intelligence") setAnalysisPanel(requested);
  }, [searchParams]);

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

  const { data: sales = [], dataUpdatedAt: salesUpdatedAt } = useSales({ startDate, endDate, adAccountId: selectedAccount === "all" ? undefined : selectedAccount });

  const camp = useColWidths<CampColKey>(CAMP_DEFAULTS, "campaigns-cols-v3");
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
              if (startDate && i.date < startDate.toISOString().split("T")[0]) continue;
              if (endDate && i.date > endDate.toISOString().split("T")[0]) continue;
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

        const campaignSales = sales.filter(s => s.campaign_ids && s.campaign_ids.includes(c.id));
        const salesCount = campaignSales.length;
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
    for (const currentAdset of campaign.adsets || []) {
      for (const currentAd of currentAdset.ads || []) {
        const resolved = resolveMetaActionMetrics(actionData?.totalsByAd[currentAd.id], actionData?.valueTotalsByAd[currentAd.id]);
        actionMetrics.linkClicks += resolved.linkClicks;
        actionMetrics.landingPageViews += resolved.landingPageViews;
        actionMetrics.checkouts += resolved.checkouts;
        actionMetrics.purchases += resolved.purchases;
        actionMetrics.purchaseValue += resolved.purchaseValue;
      }
    }

    const linkClicks = campaign.linkClicks > 0 ? campaign.linkClicks : actionMetrics.linkClicks;
    return {
      ...campaign,
      linkClicks,
      linkCpc: linkClicks > 0 ? campaign.spend / linkClicks : 0,
      landingPageViews: actionMetrics.landingPageViews,
      costPerLandingPageView: actionMetrics.landingPageViews > 0 ? campaign.spend / actionMetrics.landingPageViews : 0,
      checkouts: actionMetrics.checkouts,
      costPerCheckout: actionMetrics.checkouts > 0 ? campaign.spend / actionMetrics.checkouts : 0,
      metaPurchases: actionMetrics.purchases,
      metaCostPerPurchase: actionMetrics.purchases > 0 ? campaign.spend / actionMetrics.purchases : 0,
      metaPurchaseRoas: campaign.spend > 0 ? actionMetrics.purchaseValue / campaign.spend : 0,
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
        .select("id,name,thumbnail_url,status,adset_id,adsets!inner(id,name,campaign_id,campaigns!inner(id,name,ad_account_id))")
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
      result = result.filter((c: any) => [c.name, c.id, c.objective, c.status, c.spend, c.leads, c.cpl, c.ctr, c.roas]
        .some((value) => String(value ?? "").toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") {
      result = result.filter((c: any) => normalizeStatus(c.status) === statusFilter);
    }
    if (healthFilter !== "all") {
      result = result.filter((c: any) => getCampaignHealth(c, averageCpl, targetByCampaign.get(c.id)) === healthFilter);
    }
    result = [...result].sort((a: any, b: any) => {
      if (sortKey === "status") {
        const activeA = normalizeStatus(a.status) === "ACTIVE" ? 1 : 0;
        const activeB = normalizeStatus(b.status) === "ACTIVE" ? 1 : 0;
        const difference = activeA - activeB;

        // Primeiro clique: ativas no topo. Segundo clique: ativas no fim.
        return sortAsc ? difference : -difference;
      }

      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return result;
  }, [averageCpl, campaigns, healthFilter, search, statusFilter, sortKey, sortAsc, targetByCampaign]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedCampaigns = useMemo(() => filtered.slice(campaignPage * pageSize, (campaignPage + 1) * pageSize), [campaignPage, filtered]);
  useEffect(() => { setCampaignPage(0); }, [search, statusFilter, healthFilter, selectedAccount, startDate, endDate, sortKey, sortAsc]);
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
      budget: acc.budget + c.budget, spend: acc.spend + c.spend, leads: acc.leads + c.leads,
      salesCount: acc.salesCount + c.salesCount, revenue: acc.revenue + c.revenue,
      profit: acc.profit + c.profit, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
      reach: acc.reach + c.reach, linkClicks: acc.linkClicks + c.linkClicks,
      uniqueLinkClicks: acc.uniqueLinkClicks + c.uniqueLinkClicks,
      landingPageViews: acc.landingPageViews + c.landingPageViews,
      checkouts: acc.checkouts + c.checkouts, metaPurchases: acc.metaPurchases + c.metaPurchases,
      metaPurchaseValue: acc.metaPurchaseValue + (c.metaPurchaseRoas * c.spend),
    }),
    { budget: 0, spend: 0, leads: 0, salesCount: 0, revenue: 0, profit: 0, impressions: 0, clicks: 0, reach: 0, linkClicks: 0, uniqueLinkClicks: 0, landingPageViews: 0, checkouts: 0, metaPurchases: 0, metaPurchaseValue: 0 }
  ), [filtered]);
  const totalCtr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : 0;
  const totalCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const totalLinkCpc = totals.linkClicks > 0 ? totals.spend / totals.linkClicks : 0;
  const totalUniqueLinkCtr = totals.reach > 0 ? totals.uniqueLinkClicks / totals.reach * 100 : 0;
  const totalCostPerLandingPageView = totals.landingPageViews > 0 ? totals.spend / totals.landingPageViews : 0;
  const totalCostPerCheckout = totals.checkouts > 0 ? totals.spend / totals.checkouts : 0;
  const totalMetaCostPerPurchase = totals.metaPurchases > 0 ? totals.spend / totals.metaPurchases : 0;
  const totalMetaPurchaseRoas = totals.spend > 0 ? totals.metaPurchaseValue / totals.spend : 0;
  const totalResultRate = totals.clicks > 0 ? totals.leads / totals.clicks * 100 : 0;
  const intelligenceSeries = useMemo(() => {
    const byDate = new Map<string, { date: string; spend: number; impressions: number; clicks: number; leads: number }>();
    for (const campaign of filtered) {
      for (const currentAdset of campaign.adsets || []) {
        for (const currentAd of currentAdset.ads || []) {
          for (const insight of currentAd.insights || []) {
            if (!insight.date) continue;
            if (insight.date < formatApiDate(startDate) || insight.date > formatApiDate(endDate)) continue;
            const current = byDate.get(insight.date) ?? { date: insight.date, spend: 0, impressions: 0, clicks: 0, leads: 0 };
            current.spend += Number(insight.spend || 0);
            current.impressions += Number(insight.impressions || 0);
            current.clicks += Number(insight.clicks || 0);
            current.leads += Number(insight.leads || 0);
            byDate.set(insight.date, current);
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
  }, [endDate, filtered, startDate]);

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
    return accountAdsets
      .map((currentAdset: any) => {
        const campaign = firstRelation(currentAdset.campaigns);
        const embeddedAdset = embeddedAdsetsById.get(currentAdset.id);
        const metrics = aggregateInsights(embeddedAdset?.ads || [], startDate, endDate);
        return {
          ...currentAdset,
          ...metrics,
          campaignId: currentAdset.campaign_id,
          campaignName: campaign?.name || "Campanha sem nome",
        };
      })
      .filter((currentAdset: any) => !descendantCampaignIds || descendantCampaignIds.has(currentAdset.campaignId))
      .filter((currentAdset: any) => statusFilter === "all" || normalizeStatus(currentAdset.status) === statusFilter)
      .filter((currentAdset: any) => !query || currentAdset.name.toLowerCase().includes(query) || currentAdset.campaignName.toLowerCase().includes(query));
  }, [accountAdsets, descendantCampaignIds, embeddedAdsetsById, endDate, search, startDate, statusFilter]);

  const selectedAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return accountAds
      .map((currentAd: any) => {
        const currentAdset = firstRelation(currentAd.adsets);
        const campaign = firstRelation(currentAdset?.campaigns);
        const metrics = aggregateInsights([embeddedAdsById.get(currentAd.id)].filter(Boolean), startDate, endDate);
        return {
          ...currentAd,
          ...metrics,
          campaignId: currentAdset?.campaign_id,
          adsetName: currentAdset?.name || "Conjunto sem nome",
          campaignName: campaign?.name || "Campanha sem nome",
        };
      })
      .filter((currentAd: any) => !descendantCampaignIds || descendantCampaignIds.has(currentAd.campaignId))
      .filter((currentAd: any) => statusFilter === "all" || normalizeStatus(currentAd.status) === statusFilter)
      .filter((currentAd: any) => !query || currentAd.name.toLowerCase().includes(query) || currentAd.adsetName.toLowerCase().includes(query) || currentAd.campaignName.toLowerCase().includes(query));
  }, [accountAds, descendantCampaignIds, embeddedAdsById, endDate, search, startDate, statusFilter]);

  const adsetTotals = useMemo(() => aggregateLevelTotals(selectedAdsets), [selectedAdsets]);
  const adTotals = useMemo(() => aggregateLevelTotals(selectedAds), [selectedAds]);
  const colorClass = (v: number) => v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "";
  const sortBg = (k: CampSortKey) => sortKey === k ? "bg-primary/5" : "";
  const showColumn = (key: CampaignColumnKey) => visibleColumns.has(key);
  const cellW = (k: CampColKey) => ({ width: camp.colWidths[k], minWidth: camp.colWidths[k], maxWidth: camp.colWidths[k] });
  const adsetCellW = (k: AdsetColKey) => ({ width: adset.colWidths[k], minWidth: adset.colWidths[k], maxWidth: adset.colWidths[k] });
  const adCellW = (k: AdColKey) => ({ width: ad.colWidths[k], minWidth: ad.colWidths[k], maxWidth: ad.colWidths[k] });

  return (
    <MotionPage className="campaigns-workspace overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm dark:border-[#2a271f] dark:bg-[#070706] md:flex md:min-h-0 md:flex-1 md:flex-col">
      <MotionItem className="campaign-manager-top shrink-0 border-b border-border bg-card dark:border-[#2a271f] dark:bg-[#070706]">
        <div className="flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center gap-2">
            <h1 className="text-lg font-black tracking-tight">Campanhas</h1>
            <span className="grid h-7 w-7 place-items-center rounded-md border border-primary/25 bg-primary/10 text-[9px] font-black text-primary">GD</span>
          </div>
          {visibleAdAccounts.length > 0 && (
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="h-8 w-full bg-background text-xs sm:w-[285px]" aria-label="Trocar conta de anúncio"><SelectValue placeholder="Conta de anúncio" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as contas de anúncio</SelectItem>{visibleAdAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-primary text-[10px] font-black text-primary">{Math.max(0, Math.min(100, Math.round((healthCounts.healthy / Math.max(campaigns.length, 1)) * 100)))}</span>
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

        <div className="growdash-scrollbar flex items-center gap-2 overflow-x-auto border-t border-border/60 px-3 py-2 dark:border-[#24221c]">
          <Button variant="outline" size="sm" className="meta-toolbar-button meta-toolbar-button-active shrink-0"><FolderOpen className="h-3.5 w-3.5" />Todos os anúncios</Button>
          <Button variant="outline" size="sm" className="meta-toolbar-button shrink-0" onClick={() => setStatusFilter("ACTIVE")}><Megaphone className="h-3.5 w-3.5" />Anúncios ativos</Button>
          <Button variant="outline" size="sm" className="meta-toolbar-button shrink-0"><ShieldCheck className="h-3.5 w-3.5" />Ações</Button>
          <Button variant="outline" size="sm" className="meta-toolbar-button shrink-0" onClick={() => setStatusFilter("ACTIVE")}><Eye className="h-3.5 w-3.5" />Tiveram veiculação</Button>
          <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-2 text-[11px]"><Plus className="h-3.5 w-3.5" />Ver mais</Button>
          <Button variant="outline" size="sm" className="meta-toolbar-primary ml-auto shrink-0"><SlidersHorizontal className="h-3.5 w-3.5" />Criar visualização</Button>
        </div>

        <div className="border-t border-border/60 px-3 py-2 dark:border-[#24221c]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Pesquise para filtrar por: nome, identificação ou métrica" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 border-border bg-background pl-9 text-xs" />
          </div>
        </div>
      </MotionItem>

      {isError && <MotionItem className="border-b border-destructive/30 bg-destructive/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="font-black text-destructive">Erro ao carregar campanhas</h2><p className="text-xs text-muted-foreground">{campaignError instanceof Error ? campaignError.message : "Não foi possível consultar os dados."}</p></div><Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div></MotionItem>}

      <MotionItem className="md:min-h-0 md:flex-1 md:overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="md:flex md:h-full md:min-h-0 md:flex-col">
          <div className="growdash-scrollbar flex min-w-0 items-center overflow-x-auto border-b border-border bg-card dark:border-[#2a271f] dark:bg-[#070706]">
            <TabsList className="h-auto w-max min-w-0 shrink-0 justify-start rounded-none bg-transparent p-0">
              <TabsTrigger value="campaigns" className="h-10 min-w-[175px] shrink-0 justify-start gap-2 rounded-none border-r border-border px-3 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]">
                <FolderKanban className="h-3.5 w-3.5" /> Campanhas ({filtered.length})
              </TabsTrigger>
              <TabsTrigger value="adsets" className="h-10 min-w-[210px] shrink-0 justify-start gap-2 rounded-none border-r border-border px-3 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]">
                <Layers3 className="h-3.5 w-3.5" /> Conjuntos de anúncios ({selectedAdsets.length})
              </TabsTrigger>
              <TabsTrigger value="ads" className="h-10 min-w-[160px] shrink-0 justify-start gap-2 rounded-none px-3 text-xs data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))]">
                <RectangleHorizontal className="h-3.5 w-3.5" /> Anúncios ({selectedAds.length})
              </TabsTrigger>
            </TabsList>
            <div className="ml-auto flex shrink-0 items-center px-2 py-1.5">
              <div className="w-[230px] [&_button]:!h-8 [&_button]:!min-h-0 [&_button]:!px-2 [&_button]:text-[11px]"><DateFilterBar preset={preset} onPresetChange={setPreset} customRange={customRange} onCustomRangeChange={setCustomRange} startDate={startDate} endDate={endDate} adAccounts={[]} selectedAccount="" onAccountChange={() => {}} showSummary={false} /></div>
            </div>
          </div>

          <div className="growdash-scrollbar flex min-h-11 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-border bg-card px-3 py-1.5 dark:border-[#2a271f] dark:bg-[#090908]">
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" className="h-8 gap-2 bg-emerald-700 px-3 text-[11px] font-black text-white hover:bg-emerald-600" onClick={() => setCreateCampaignOpen(true)}><Plus className="h-3.5 w-3.5" />Criar</Button>
              <Button variant="outline" size="sm" className="meta-toolbar-button" disabled={selectedIds.size === 0}><CopyIcon className="h-3.5 w-3.5" />Duplicar</Button>
              <Button variant="outline" size="sm" className="meta-toolbar-button" disabled={!selectedCampaign} onClick={() => selectedCampaign && setEditingEntity({ type: "campaign", id: selectedCampaign.id, name: selectedCampaign.name, status: selectedCampaign.status, dailyBudget: selectedCampaign.daily_budget ?? selectedCampaign.budget })}><Pencil className="h-3.5 w-3.5" />Editar</Button>
              <Button variant="outline" size="sm" className="meta-toolbar-button" disabled={selectedIds.size === 0}><FlaskConical className="h-3.5 w-3.5" />Teste A/B</Button>
              <Button variant="ghost" size="sm" className="h-8 gap-2 text-[11px]">Mais<ChevronDown className="h-3 w-3" /></Button>
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-8 w-full bg-background sm:w-[160px]"><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="ACTIVE">Ativa</SelectItem><SelectItem value="PAUSED">Pausada</SelectItem><SelectItem value="ARCHIVED">Arquivada</SelectItem><SelectItem value="IN_PROCESS">Em análise</SelectItem></SelectContent></Select>
              <Button variant="outline" size="sm" onClick={() => { camp.reset(); adset.reset(); ad.reset(); }} className="meta-toolbar-button"><RotateCcw className="h-3.5 w-3.5" />Resetar</Button>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {activeTab === "campaigns" && <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className={cn("meta-toolbar-button", analysisPanel && "meta-toolbar-button-active")}><BarChart3 className="h-3.5 w-3.5" />Análises<ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { const opening = analysisPanel !== "alerts"; updateAnalysisPanel(opening ? "alerts" : null); if (!opening) setHealthFilter("all"); }}><Sparkles className="mr-2 h-4 w-4 text-primary" />Alertas operacionais</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { setHealthFilter("all"); updateAnalysisPanel(analysisPanel === "intelligence" ? null : "intelligence"); }}><BrainCircuit className="mr-2 h-4 w-4 text-primary" />Intelligence</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>}
              {activeTab === "campaigns" ? <MetaTableControls preset={columnPreset} columns={visibleColumns} breakdown={breakdown} onPreset={setColumnPreset} onColumns={setVisibleColumns} onBreakdown={setBreakdown} /> : <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><SlidersHorizontal className="h-4 w-4" />Colunas redimensionáveis</span>}
            </div>
          </div>

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

          {activeTab === "campaigns" && breakdown !== "none" && <div className="flex items-start gap-2 border-b border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-700 dark:text-amber-300"><TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span><b>{getBreakdownLabel(breakdown)} selecionado.</b> A interface está pronta, mas este corte exige que a sincronização da Meta grave breakdowns por linha. Até isso ocorrer, os totais abaixo continuam consolidados e não são duplicados artificialmente.</span></div>}
          {activeTab === "campaigns" && analysisPanel === "alerts" && (
            <section className="campaign-analysis-shell border-b border-primary/20 md:max-h-[34dvh] md:shrink-0 md:overflow-y-auto">
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
          <TabsContent value="campaigns" className="m-0 md:min-h-0 md:flex-1 md:overflow-hidden">
            {isLoading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />)}</div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-black">Nenhuma campanha encontrada</h3>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">Revise os filtros ou conecte e sincronize uma conta Meta Ads para carregar campanhas reais.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2"><Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); setHealthFilter("all"); }}><RotateCcw className="mr-2 h-4 w-4" />Limpar filtros</Button><Button onClick={() => navigate("/integracoes")}><Megaphone className="mr-2 h-4 w-4" />Conectar Meta Ads</Button></div>
                </CardContent>
              </Card>
            ) : (
              <Card className="relative overflow-hidden rounded-none border-0 shadow-none md:flex md:h-full md:min-h-0 md:flex-col">
                <div className="space-y-2 p-2 md:hidden">
                  {pagedCampaigns.map((campaign: any) => <CampaignMobileCard key={campaign.id} campaign={campaign} selected={selectedIds.has(campaign.id)} health={getCampaignHealth(campaign, averageCpl, targetByCampaign.get(campaign.id))} onSelect={() => toggleSelect(campaign.id)} onOpen={() => setDetailCampaignId(campaign.id)} onEdit={() => setEditingEntity({ type: "campaign", id: campaign.id, name: campaign.name, status: campaign.status, dailyBudget: campaign.daily_budget ?? campaign.budget })} />)}
                </div>
                <div data-campaign-table-scroll className="growdash-scrollbar hidden min-h-0 flex-1 overflow-auto md:block">
                  <Table style={{ tableLayout: "fixed", width: "max-content" }}>
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
                        {pagedCampaigns.map((c: any, rowIndex: number) => {
                          const stickySurface = selectedIds.has(c.id) ? "bg-accent dark:bg-[#201b0d]" : rowIndex % 2 ? "bg-muted dark:bg-[#0c0c0b]" : "bg-card dark:bg-[#070706]";
                          return (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`group h-11 cursor-pointer border-b border-border transition-colors hover:bg-primary/5 [&>td]:px-3 [&>td]:py-1 dark:border-[#24221c] dark:hover:bg-[#18150c] ${selectedIds.has(c.id) ? "bg-primary/10" : "odd:bg-card even:bg-muted/20 dark:odd:bg-[#070706] dark:even:bg-[#0c0c0b]"}`}
                            onClick={() => setDetailCampaignId(c.id)}
                          >
                            <TableCell style={{ ...cellW("check"), left: 0 }} className={cn("sticky z-20 transition-colors group-hover:bg-accent", stickySurface)} onClick={(e) => e.stopPropagation()}>
                              <Checkbox className="h-4 w-4 rounded-full border-primary/80" checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                            </TableCell>
                            <TableCell style={{ ...cellW("delivery"), left: camp.colWidths.check }} className={cn("sticky z-20 transition-colors group-hover:bg-accent", stickySurface)} onClick={(event) => event.stopPropagation()}>
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
                            <TableCell style={{ ...cellW("name"), left: camp.colWidths.check + camp.colWidths.delivery }} className={cn("sticky z-20 border-r border-border/80 font-medium shadow-[8px_0_14px_-14px_rgba(0,0,0,.85)] transition-colors group-hover:bg-accent", stickySurface)}>
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
                            {showColumn("leads") && <TableCell style={cellW("leads")} className={cn("text-right tabular-nums text-sm", sortBg("leads"))}><AnimatedNumber value={c.leads} decimals={0} /><span className="block text-[8px] text-muted-foreground">Leads na Meta</span></TableCell>}
                            {showColumn("cpl") && <TableCell style={cellW("cpl")} className={cn("text-right tabular-nums text-sm", sortBg("cpl"))}><AnimatedNumber value={c.cpl} prefix="R$ " decimals={2} /></TableCell>}
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
                    <TableFooter className="campaign-total-bar">
                      <TableRow data-campaign-totals className="h-14 border-b border-border/70 bg-transparent hover:bg-transparent dark:border-[#2a271f] [&>td]:px-3 [&>td]:py-1">
                        <CampaignTotalCell width={camp.colWidths.check} stickyLeft={0} />
                        <CampaignTotalCell width={camp.colWidths.delivery} stickyLeft={camp.colWidths.check} />
                        <CampaignTotalCell
                          width={camp.colWidths.name}
                          value={`Resultados de ${filtered.length} campanhas`}
                          label="Totais do período e filtros selecionados"
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
                        {showColumn("leads") && <CampaignTotalCell width={camp.colWidths.leads} value={totals.leads.toLocaleString("pt-BR")} label="Resultados" />}
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
                    </TableFooter>
                  </Table>
                </div>
                {pageCount > 1 && <div className="flex h-8 shrink-0 items-center justify-between gap-3 border-t border-border/60 px-3 dark:border-[#24221c]"><span className="text-[9px] text-muted-foreground">Exibindo {campaignPage * pageSize + 1}–{Math.min((campaignPage + 1) * pageSize, filtered.length)} de {filtered.length}</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCampaignPage((page) => Math.max(0, page - 1))} disabled={campaignPage === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="min-w-16 text-center text-[9px]">{campaignPage + 1} / {pageCount}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCampaignPage((page) => Math.min(pageCount - 1, page + 1))} disabled={campaignPage + 1 >= pageCount}><ChevronRight className="h-3.5 w-3.5" /></Button></div></div>}
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
                      <ResizableHead colKey="name" width={adset.colWidths.name} onResize={adset.startResize("name")}>Conjunto</ResizableHead>
                      <ResizableHead colKey="campaign" width={adset.colWidths.campaign} onResize={adset.startResize("campaign")}>Campanha</ResizableHead>
                      <ResizableHead colKey="spend" width={adset.colWidths.spend} onResize={adset.startResize("spend")} align="right">Gastos</ResizableHead>
                      <ResizableHead colKey="budget" width={adset.colWidths.budget} onResize={adset.startResize("budget")} align="right">Orçamento Diário</ResizableHead>
                      <ResizableHead colKey="impressions" width={adset.colWidths.impressions} onResize={adset.startResize("impressions")} align="right">Impressões</ResizableHead>
                      <ResizableHead colKey="cpm" width={adset.colWidths.cpm} onResize={adset.startResize("cpm")} align="right">CPM</ResizableHead>
                      <ResizableHead colKey="reach" width={adset.colWidths.reach} onResize={adset.startResize("reach")} align="right">Alcance*</ResizableHead>
                      <ResizableHead colKey="frequency" width={adset.colWidths.frequency} onResize={adset.startResize("frequency")} align="right">Frequência*</ResizableHead>
                      <ResizableHead colKey="clicks" width={adset.colWidths.clicks} onResize={adset.startResize("clicks")} align="right">Cliques</ResizableHead>
                      <ResizableHead colKey="ctr" width={adset.colWidths.ctr} onResize={adset.startResize("ctr")} align="right">CTR</ResizableHead>
                      <ResizableHead colKey="cpc" width={adset.colWidths.cpc} onResize={adset.startResize("cpc")} align="right">CPC</ResizableHead>
                      <ResizableHead colKey="leads" width={adset.colWidths.leads} onResize={adset.startResize("leads")} align="right">Resultados</ResizableHead>
                      <ResizableHead colKey="cpl" width={adset.colWidths.cpl} onResize={adset.startResize("cpl")} align="right">Custo por resultado</ResizableHead>
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
                      <ResizableHead colKey="name" width={ad.colWidths.name} onResize={ad.startResize("name")}>Anúncio</ResizableHead>
                      <ResizableHead colKey="adset" width={ad.colWidths.adset} onResize={ad.startResize("adset")}>Conjunto</ResizableHead>
                      <ResizableHead colKey="campaign" width={ad.colWidths.campaign} onResize={ad.startResize("campaign")}>Campanha</ResizableHead>
                      <ResizableHead colKey="spend" width={ad.colWidths.spend} onResize={ad.startResize("spend")} align="right">Gastos</ResizableHead>
                      <ResizableHead colKey="impressions" width={ad.colWidths.impressions} onResize={ad.startResize("impressions")} align="right">Impressões</ResizableHead>
                      <ResizableHead colKey="cpm" width={ad.colWidths.cpm} onResize={ad.startResize("cpm")} align="right">CPM</ResizableHead>
                      <ResizableHead colKey="reach" width={ad.colWidths.reach} onResize={ad.startResize("reach")} align="right">Alcance*</ResizableHead>
                      <ResizableHead colKey="frequency" width={ad.colWidths.frequency} onResize={ad.startResize("frequency")} align="right">Frequência*</ResizableHead>
                      <ResizableHead colKey="clicks" width={ad.colWidths.clicks} onResize={ad.startResize("clicks")} align="right">Cliques</ResizableHead>
                      <ResizableHead colKey="ctr" width={ad.colWidths.ctr} onResize={ad.startResize("ctr")} align="right">CTR</ResizableHead>
                      <ResizableHead colKey="cpc" width={ad.colWidths.cpc} onResize={ad.startResize("cpc")} align="right">CPC</ResizableHead>
                      <ResizableHead colKey="leads" width={ad.colWidths.leads} onResize={ad.startResize("leads")} align="right">Leads</ResizableHead>
                      <ResizableHead colKey="cpl" width={ad.colWidths.cpl} onResize={ad.startResize("cpl")} align="right">CPL</ResizableHead>
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
  return (
    <section className="campaign-analysis-shell border-b border-primary/20 md:max-h-[52dvh] md:shrink-0 md:overflow-y-auto">
      <header className="campaign-analysis-header flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black"><BrainCircuit className="h-4 w-4 text-primary" />Growdash Intelligence</h2>
          <p className="text-[10px] text-muted-foreground">Diagnóstico quantitativo da entrega, eficiência e resultado no período selecionado.</p>
        </div>
        <Badge variant="outline" className="w-fit">{series.length} dia(s) com dados</Badge>
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
        <AnalysisMetric label="Leads" value={Number(totals.leads || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} />
        <AnalysisMetric label="CPL" value={currency(Number(totalCpl || 0))} />
        <AnalysisMetric label="ROAS" value={`${Number(totalRoas || 0).toFixed(2).replace(".", ",")}x`} />
        <AnalysisMetric label="CPM" value={currency(Number(totalCpm || 0))} />
        <AnalysisMetric label="Cliques" value={Number(totals.clicks || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} />
        <AnalysisMetric label="CPC" value={currency(Number(totalCpc || 0))} />
        <AnalysisMetric label="Taxa de resultado" value={`${Number(totalResultRate || 0).toFixed(2).replace(".", ",")}%`} />
      </div>

        <div className="relative grid gap-3 border-t border-border p-3 xl:grid-cols-2">
          {series.length === 0 && <span className="absolute right-5 top-5 z-10 rounded-full border border-border bg-background/90 px-2 py-1 text-[9px] font-bold text-muted-foreground">Sem dados no período · exibindo estrutura zerada</span>}
          <ChartPanel title="Investimento × leads" description="Evolução diária com duas escalas para não distorcer volume e custo.">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={safeSeries} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="money" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis yAxisId="volume" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [name === "Investimento" ? currency(value) : Number(value).toLocaleString("pt-BR"), name]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="money" dataKey="spend" name="Investimento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Line yAxisId="volume" type="monotone" dataKey="leads" name="Leads" stroke="hsl(var(--success))" strokeWidth={2.5} dot={false} />
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
                <Line type="monotone" dataKey="cpc" name="CPC" stroke="#fbbf24" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cpl" name="CPL" stroke="#fb7185" strokeWidth={2} dot={false} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      </>}

      {view === "campaigns" && <EntityIntelligenceTable title="Desempenho por campanha" nameLabel="Campanha" entities={campaigns} />}
      {view === "adsets" && <EntityIntelligenceTable title="Desempenho por conjunto de anúncios" nameLabel="Conjunto de anúncios" entities={adsets} />}
      {view === "creatives" && <EntityIntelligenceTable title="Desempenho por criativo" nameLabel="Criativo" entities={ads} />}

      {view === "actions" && <div className="border-t border-border">
        <TrafficAIAnalysis accountId={accountId} accountName={accountName} startDate={startDate} endDate={endDate} selectedCampaignIds={selectedCampaignIds} />
      </div>}

      {view === "overview" && <div className="border-t border-border bg-muted/10 px-4 py-3 text-[10px] text-muted-foreground">
        Use as abas para comparar métricas, campanhas, conjuntos e criativos sem sair do gerenciador. Os filtros de conta, campanha e período permanecem aplicados.
      </div>}
    </section>
  );
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

function CampaignTotalCell({ width, value, label, align = "right", stickyLeft, strongDivider = false }: { width: number; value?: string; label?: string; align?: "left" | "right"; stickyLeft?: number; strongDivider?: boolean }) {
  return <TableCell
    style={{ width, minWidth: width, maxWidth: width, ...(stickyLeft !== undefined ? { left: stickyLeft } : {}) }}
    className={cn(
      "tabular-nums",
      align === "right" ? "text-right" : "text-left",
      stickyLeft !== undefined && "sticky z-30 bg-muted/95 backdrop-blur-xl dark:bg-[#11110f]/95",
      strongDivider && "border-r border-border shadow-[8px_0_14px_-14px_rgba(0,0,0,.9)] dark:border-[#28251e]",
    )}
  >
    {value && <strong className="block truncate text-[10px] font-semibold text-foreground">{value}</strong>}
    {label && <span className="mt-0.5 block truncate text-[8px] leading-tight text-muted-foreground">{label}</span>}
  </TableCell>;
}

function TotalMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[118px] shrink-0 rounded-lg border border-border/70 bg-muted/35 px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-0.5 block whitespace-nowrap text-xs tabular-nums">{value}</strong></div>;
}

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return <div className="campaign-analysis-card px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-1 block text-sm tabular-nums">{value}</strong></div>;
}

function AnalysisCampaignAlert({ campaign, health, targetCpl, accountName, onOpen }: { campaign: any; health: CampaignHealth; targetCpl: number; accountName: string; onOpen: () => void }) {
  const option = HEALTH_OPTIONS.find((item) => item.id === health)!;
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
        <IssueMetric label="Resultados" value={campaign.leads.toLocaleString("pt-BR")} />
        <IssueMetric label="Custo/resultado" value={campaign.cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
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
  return <article className={cn("rounded-xl border bg-card p-3", selected ? "border-primary bg-primary/5" : "border-border")}><div className="flex items-start gap-3"><Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Selecionar ${campaign.name}`} /><button type="button" onClick={onOpen} className="min-w-0 grow text-left"><span className="block truncate text-sm font-black">{campaign.name}</span><span className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", healthOption.dot)} />{healthOption.label} · {getStatusBadge(campaign.status).label}</span></button><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onEdit}><Pencil className="h-4 w-4" /></Button></div><button type="button" onClick={onOpen} className="mt-3 grid w-full grid-cols-2 gap-2 text-left"><IssueMetric label="Investimento" value={campaign.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><IssueMetric label="Resultados" value={campaign.leads.toLocaleString("pt-BR")} /><IssueMetric label="CPL" value={campaign.cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><IssueMetric label="CTR" value={`${campaign.ctr.toFixed(2).replace(".", ",")}%`} /></button></article>;
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
  return <div className="campaign-total-bar z-20 shrink-0 px-3 py-3"><div className="growdash-scrollbar flex gap-2 overflow-x-auto"><TotalMetric label="Total" value={`${count} ${label}`} /><TotalMetric label="Investimento" value={totals.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><TotalMetric label="Impressões" value={totals.impressions.toLocaleString("pt-BR")} /><TotalMetric label="Alcance*" value={totals.reach.toLocaleString("pt-BR")} /><TotalMetric label="Cliques" value={totals.clicks.toLocaleString("pt-BR")} /><TotalMetric label="CTR" value={`${ctr.toFixed(2).replace(".", ",")}%`} /><TotalMetric label="Resultados" value={totals.leads.toLocaleString("pt-BR")} /><TotalMetric label="CPL" value={cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /></div></div>;
}
