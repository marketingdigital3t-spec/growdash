import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  TriangleAlert,
  Download,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BrainCircuit,
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
import { ResizableHead, StatusDot, normalizeStatus, useColWidths } from "@/components/dashboard/ResizableTableHelpers";
import { cn } from "@/lib/utils";
import { getStatusBadge } from "@/lib/status";
import { MetaTableControls } from "@/components/campaigns/MetaTableControls";
import { getBreakdownLabel, getMetaColumnPreset, type CampaignColumnKey, type MetaColumnPresetKey } from "@/lib/metaTableConfig";
import { TrafficAIAnalysis } from "@/components/campaigns/TrafficAIAnalysis";
import { MetaEntityDetailSheet, type MetaDetailEntity } from "@/components/campaigns/MetaEntityDetailSheet";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { pruneCampaignSelection, scopeCampaignHierarchy } from "@/lib/metaHierarchy";
import { getCampaignActiveDays, getCampaignHealth, type CampaignHealth } from "@/lib/campaignHealth";

type CampSortKey = "name" | "objective" | "budget" | "salesCount" | "cpa" | "spend" | "leads" | "profit" | "roi" | "roas" | "revenue" | "cpl" | "ctr" | "cpc" | "cpm" | "conversionRate" | "clicks" | "impressions" | "reach" | "frequency";
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
  check: 44, name: 300, delivery: 156, objective: 130, budget: 120, spend: 120, impressions: 120,
  reach: 110, frequency: 100, cpm: 110, clicks: 110, ctr: 100, cpc: 100, leads: 110, cpl: 120,
  conversion: 120, sales: 105, cpa: 120, revenue: 135, roas: 100, profit: 130, roi: 100,
  videoViews: 140, actions: 86,
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
  const [sortKey, setSortKey] = useState<CampSortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [columnPreset, setColumnPreset] = useState<MetaColumnPresetKey>("performance");
  const [visibleColumns, setVisibleColumns] = useState<Set<CampaignColumnKey>>(() => {
    try { const saved = JSON.parse(localStorage.getItem("growdash:meta-columns") || "[]"); if (Array.isArray(saved) && saved.length) return new Set(saved); } catch { /* usa o preset padrão */ }
    return new Set(getMetaColumnPreset("performance").columns);
  });
  const [breakdown, setBreakdown] = useState(() => localStorage.getItem("growdash:meta-breakdown") || "none");
  const [campaignPage, setCampaignPage] = useState(0);
  const [healthFilter, setHealthFilter] = useState<CampaignHealth | "all">("all");
  const [analysisPanel, setAnalysisPanel] = useState<"alerts" | "intelligence" | null>(null);
  const pageSize = 50;

  useEffect(() => {
    localStorage.setItem("growdash:meta-columns", JSON.stringify(Array.from(visibleColumns)));
    localStorage.setItem("growdash:meta-breakdown", breakdown);
  }, [visibleColumns, breakdown]);

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
  const { data: sales = [], dataUpdatedAt: salesUpdatedAt } = useSales({ startDate, endDate, adAccountId: selectedAccount === "all" ? undefined : selectedAccount });

  const camp = useColWidths<CampColKey>(CAMP_DEFAULTS, "campaigns-cols-v1");
  const adset = useColWidths<AdsetColKey>(ADSET_DEFAULTS, "campaigns-adset-cols-v1");
  const ad = useColWidths<AdColKey>(AD_DEFAULTS, "campaigns-ad-cols-v1");

  const handleSort = (key: CampSortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const { data: campaigns = [], isLoading, isFetching, isError, error: campaignError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["campaigns_full", selectedAccount, visibleAdAccounts.map((account) => account.id).join(","), startDate?.toISOString(), endDate?.toISOString(), salesUpdatedAt],
    queryFn: async () => {
      let query = supabase
        .from("campaigns")
        .select(`
          id, name, ad_account_id, status, objective, created_at,
          adsets(
            id, name, daily_budget, status,
            ads(
              id, name, thumbnail_url, status,
              insights(spend, leads, clicks, impressions, reach, ctr, cpm, cpl, frequency, conversion_rate, health_score, date)
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
        let spend = 0, leads = 0, clicks = 0, impressions = 0, reach = 0;
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

        return { ...c, adsets, budget, spend, leads, clicks, impressions, reach, frequency, salesCount, revenue, profit, roi, roas, cpa, cpl, ctr, cpc, cpm, conversionRate };
      });
    },
  });

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
  useEffect(() => { setCampaignPage(0); }, [search, statusFilter, healthFilter, selectedAccount, startDate, endDate]);
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

  const downloadCampaigns = () => {
    const header = ["Campanha", "Status", "Objetivo", "Orçamento", "Valor usado", "Impressões", "Alcance", "Frequência", "CPM", "Cliques", "CTR", "CPC", "Leads", "CPL", "Conversão", "Vendas", "CPA", "Receita", "ROAS", "Lucro", "ROI"];
    const rows = filtered.map((item: any) => [item.name, item.status, item.objective || "", item.budget, item.spend, item.impressions, item.reach, item.frequency, item.cpm, item.clicks, item.ctr, item.cpc, item.leads, item.cpl, item.conversionRate, item.salesCount, item.cpa, item.revenue, item.roas, item.profit, item.roi]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `growdash-campanhas-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => filtered.reduce(
    (acc: any, c: any) => ({
      budget: acc.budget + c.budget, spend: acc.spend + c.spend, leads: acc.leads + c.leads,
      salesCount: acc.salesCount + c.salesCount, revenue: acc.revenue + c.revenue,
      profit: acc.profit + c.profit, impressions: acc.impressions + c.impressions, clicks: acc.clicks + c.clicks,
      reach: acc.reach + c.reach,
    }),
    { budget: 0, spend: 0, leads: 0, salesCount: 0, revenue: 0, profit: 0, impressions: 0, clicks: 0, reach: 0 }
  ), [filtered]);
  const totalCtr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : 0;
  const totalCpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
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

  const activeCampaigns = useMemo(() => campaigns.filter((campaign: any) => {
    const matchesSearch = !search || campaign.name.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && normalizeStatus(campaign.status) === "ACTIVE";
  }).length, [campaigns, search]);

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
  const downloadCurrentView = () => {
    if (activeTab === "campaigns") { downloadCampaigns(); return; }
    const source = activeTab === "adsets" ? selectedAdsets : selectedAds;
    const label = activeTab === "adsets" ? "conjuntos" : "anuncios";
    const header = activeTab === "adsets"
      ? ["Conjunto", "Campanha", "Status", "Orçamento", "Investimento", "Impressões", "Alcance", "Cliques", "Leads", "CPL"]
      : ["Anúncio", "Conjunto", "Campanha", "Status", "Investimento", "Impressões", "Alcance", "Cliques", "CTR", "CPC", "Leads", "CPL"];
    const rows = source.map((item: any) => activeTab === "adsets"
      ? [item.name, item.campaignName, item.status, item.daily_budget || 0, item.spend, item.impressions, item.reach, item.clicks, item.leads, item.leads > 0 ? item.spend / item.leads : 0]
      : [item.name, item.adsetName, item.campaignName, item.status, item.spend, item.impressions, item.reach, item.clicks, item.impressions > 0 ? item.clicks / item.impressions * 100 : 0, item.clicks > 0 ? item.spend / item.clicks : 0, item.leads, item.leads > 0 ? item.spend / item.leads : 0]);
    exportCsv(header, rows, `growdash-${label}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const colorClass = (v: number) => v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "";
  const sortBg = (k: CampSortKey) => sortKey === k ? "bg-primary/5" : "";
  const showColumn = (key: CampaignColumnKey) => visibleColumns.has(key);
  const cellW = (k: CampColKey) => ({ width: camp.colWidths[k], minWidth: camp.colWidths[k], maxWidth: camp.colWidths[k] });
  const adsetCellW = (k: AdsetColKey) => ({ width: adset.colWidths[k], minWidth: adset.colWidths[k], maxWidth: adset.colWidths[k] });
  const adCellW = (k: AdColKey) => ({ width: ad.colWidths[k], minWidth: ad.colWidths[k], maxWidth: ad.colWidths[k] });

  return (
    <MotionPage className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <MotionItem className="border-b border-border bg-gradient-to-r from-primary/5 via-card to-muted px-3 py-3 sm:px-4">
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
            {visibleAdAccounts.length > 0 && (
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="h-9 w-full border-border bg-background sm:w-[260px]">
                  <SelectValue placeholder="Conta de anúncio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas de anúncio</SelectItem>
                  {visibleAdAccounts.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {dataUpdatedAt ? `Atualizado às ${new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "Aguardando dados"}
            </span>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isFetching || syncMeta.isPending} className="h-9 gap-2 bg-background">
              <RefreshCw className={cn("h-4 w-4", (isFetching || syncMeta.isPending) && "animate-spin")} /> {syncMeta.isPending ? "Sincronizando…" : "Atualizar"}
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem className="border-b border-border bg-muted/40 px-3 py-2 sm:px-4">
        <div className="growdash-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setStatusFilter("all"); setHealthFilter("all"); }}
            className={cn("h-9 shrink-0 gap-2 bg-background", statusFilter === "all" && "border-primary bg-primary/10 text-foreground")}
          >
            <FolderKanban className="h-4 w-4" /> Todos os anúncios
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusFilter("ACTIVE")}
            className={cn("h-9 shrink-0 gap-2 bg-background", statusFilter === "ACTIVE" && "border-primary bg-primary/10 text-foreground")}
          >
            <CheckCircle2 className="h-4 w-4" /> Ativos ({activeCampaigns})
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSortKey("roi"); setSortAsc(false); }} className="h-9 shrink-0 gap-2 bg-background">
            <BarChart3 className="h-4 w-4" /> Desempenho e ROAS
          </Button>
          <div className="ml-auto hidden items-center gap-2 text-[11px] text-muted-foreground lg:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Alterações exigem confirmação e são enviadas pelo backend seguro.
          </div>
        </div>
      </MotionItem>

      <MotionItem className="border-b border-border bg-muted/70 p-2 sm:p-3">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquise para filtrar por: nome, identificação ou métrica"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-border bg-background pl-9"
            />
          </div>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full bg-background sm:w-[180px]"><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="ACTIVE"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ativa</span></SelectItem>
                  <SelectItem value="PAUSED"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Pausada</span></SelectItem>
                  <SelectItem value="ARCHIVED"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> Arquivada</span></SelectItem>
                  <SelectItem value="IN_PROCESS"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-blue-500" /> Em análise</span></SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { camp.reset(); adset.reset(); ad.reset(); }} className="h-9 gap-2 bg-background" title="Restaurar largura das colunas">
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

      {isError && <MotionItem className="border-b border-destructive/30 bg-destructive/5 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div><h2 className="font-black text-destructive">Erro ao carregar campanhas</h2><p className="text-xs text-muted-foreground">{campaignError instanceof Error ? campaignError.message : "Não foi possível consultar os dados."}</p></div><Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div></MotionItem>}

      <MotionItem>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="growdash-scrollbar h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-muted/50 p-0">
            <TabsTrigger value="campaigns" className="h-11 min-w-[180px] shrink-0 justify-start gap-2 rounded-none border-r border-border px-4 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-3px_0_hsl(var(--primary))]">
              <FolderKanban className="h-4 w-4" /> Campanhas <Badge variant="secondary" className="ml-auto tabular-nums">{filtered.length}</Badge>
              {selectedIds.size > 0 && <Badge className="border-primary/40 bg-primary/15 text-foreground" title="Campanhas selecionadas">{selectedIds.size} sel.</Badge>}
            </TabsTrigger>
            <TabsTrigger value="adsets" className="h-11 min-w-[220px] shrink-0 justify-start gap-2 rounded-none border-r border-border px-4 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-3px_0_hsl(var(--primary))]">
              <Layers3 className="h-4 w-4" /> Conjuntos de anúncios <Badge variant="secondary" className="ml-auto tabular-nums">{selectedAdsets.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ads" className="h-11 min-w-[180px] shrink-0 justify-start gap-2 rounded-none px-4 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-3px_0_hsl(var(--primary))]">
              <RectangleHorizontal className="h-4 w-4" /> Anúncios <Badge variant="secondary" className="ml-auto tabular-nums">{selectedAds.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
            {activeTab === "campaigns" && <>
            <Button
              size="sm"
              disabled={!selectedCampaign}
              onClick={() => selectedCampaign && setEditingEntity({ type: "campaign", id: selectedCampaign.id, name: selectedCampaign.name, status: selectedCampaign.status })}
              className="h-8 gap-2"
            >
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedCampaign} onClick={() => selectedCampaign && setDetailCampaignId(selectedCampaign.id)} className="h-8 gap-2">
              <Eye className="h-4 w-4" /> Ver desempenho
            </Button>
            </>}
            <Button size="sm" onClick={downloadCurrentView} disabled={(activeTab === "campaigns" ? filtered : activeTab === "adsets" ? selectedAdsets : selectedAds).length === 0} className="gold-action h-8 gap-2">
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">Baixar relatório</span>
            </Button>
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                  <Badge variant="secondary">{selectedIds.size} selecionada{selectedIds.size > 1 ? "s" : ""}</Badge>
                  {selectedCampaign && <span className="max-w-[260px] truncate text-[10px] text-muted-foreground">Filtrando por: <b className="text-foreground">{selectedCampaign.name}</b></span>}
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-8 gap-1 text-xs">
                    <X className="h-3 w-3" /> Limpar
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {activeTab === "campaigns" && <>
                <Button variant="outline" size="sm" onClick={() => { const opening = analysisPanel !== "alerts"; setAnalysisPanel(opening ? "alerts" : null); if (!opening) setHealthFilter("all"); }} className={cn("h-8 gap-2", analysisPanel === "alerts" && "border-primary bg-primary/10 text-foreground")} aria-pressed={analysisPanel === "alerts"}><Sparkles className="h-4 w-4 text-primary" />Análises</Button>
                <Button variant="outline" size="sm" onClick={() => { setHealthFilter("all"); setAnalysisPanel(analysisPanel === "intelligence" ? null : "intelligence"); }} className={cn("h-8 gap-2", analysisPanel === "intelligence" && "border-primary bg-primary/10 text-foreground")} aria-pressed={analysisPanel === "intelligence"}><BrainCircuit className="h-4 w-4 text-primary" />Intelligence</Button>
              </>}
              {activeTab === "campaigns" ? <MetaTableControls preset={columnPreset} columns={visibleColumns} breakdown={breakdown} onPreset={setColumnPreset} onColumns={setVisibleColumns} onBreakdown={setBreakdown} /> : <span className="flex items-center gap-2 text-[11px] text-muted-foreground"><SlidersHorizontal className="h-4 w-4" />Colunas redimensionáveis</span>}
            </div>
          </div>

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
            <section className="border-b border-primary/20 bg-muted/15">
              <header className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
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
                    return <button key={option.id} type="button" title={`${count} campanha(s) classificadas como ${option.label.toLowerCase()} no período selecionado`} onClick={() => setHealthFilter(selected ? "all" : option.id)} className={cn("flex min-h-14 min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left transition hover:border-primary/35 hover:bg-primary/5", selected && option.active, option.id === "critical" && count > 0 && "shadow-[0_0_18px_-10px_rgba(239,68,68,.9)]")} aria-pressed={selected}><span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", option.dot, option.id === "critical" && count > 0 && "animate-pulse")} /><span className="min-w-0 grow"><span className="block truncate text-[9px] font-black uppercase tracking-wide">{option.label}</span><span className="block text-lg font-black tabular-nums">{count}</span></span></button>;
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
              accountId={selectedAccount}
              accountName={visibleAdAccounts.find((account) => account.id === selectedAccount)?.name}
              startDate={startDate}
              endDate={endDate}
              selectedCampaignIds={Array.from(selectedIds)}
            />
          )}

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="m-0">
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
              <Card className="overflow-hidden rounded-none border-0 shadow-none">
                <div className="space-y-2 p-2 md:hidden">
                  {pagedCampaigns.map((campaign: any) => <CampaignMobileCard key={campaign.id} campaign={campaign} selected={selectedIds.has(campaign.id)} health={getCampaignHealth(campaign, averageCpl, targetByCampaign.get(campaign.id))} onSelect={() => toggleSelect(campaign.id)} onOpen={() => setDetailCampaignId(campaign.id)} onEdit={() => setEditingEntity({ type: "campaign", id: campaign.id, name: campaign.name, status: campaign.status })} />)}
                </div>
                <div className="growdash-scrollbar hidden overflow-x-auto md:block">
                  <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                    <TableHeader className="sticky top-0 z-50 bg-card shadow-[0_1px_0_hsl(var(--border))]">
                      <TableRow className="h-11 border-b border-border bg-muted/60 hover:bg-muted/60">
                        <ResizableHead colKey="check" width={camp.colWidths.check} onResize={camp.startResize("check")} className="sticky left-0 z-40 bg-muted">
                          <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                        </ResizableHead>
                        <ResizableHead colKey="delivery" width={camp.colWidths.delivery} onResize={camp.startResize("delivery")} className="sticky z-40 bg-muted" style={{ left: camp.colWidths.check }}>Desativado/Ativado</ResizableHead>
                        <ResizableHead colKey="name" width={camp.colWidths.name} onResize={camp.startResize("name")} sortable sortableKey="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} className="sticky z-40 border-r border-border bg-muted shadow-[8px_0_14px_-14px_rgba(0,0,0,.85)]" style={{ left: camp.colWidths.check + camp.colWidths.delivery }}>Campanha</ResizableHead>
                        {showColumn("objective") && <ResizableHead colKey="objective" width={camp.colWidths.objective} onResize={camp.startResize("objective")} sortable sortableKey="objective" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort}>Objetivo</ResizableHead>}
                        {showColumn("budget") && <ResizableHead colKey="budget" width={camp.colWidths.budget} onResize={camp.startResize("budget")} sortable sortableKey="budget" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Orçamento</ResizableHead>}
                        {showColumn("spend") && <ResizableHead colKey="spend" width={camp.colWidths.spend} onResize={camp.startResize("spend")} sortable sortableKey="spend" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Valor usado</ResizableHead>}
                        {showColumn("impressions") && <ResizableHead colKey="impressions" width={camp.colWidths.impressions} onResize={camp.startResize("impressions")} sortable sortableKey="impressions" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Impressões</ResizableHead>}
                        {showColumn("reach") && <ResizableHead colKey="reach" width={camp.colWidths.reach} onResize={camp.startResize("reach")} sortable sortableKey="reach" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Alcance*</ResizableHead>}
                        {showColumn("frequency") && <ResizableHead colKey="frequency" width={camp.colWidths.frequency} onResize={camp.startResize("frequency")} sortable sortableKey="frequency" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Frequência*</ResizableHead>}
                        {showColumn("cpm") && <ResizableHead colKey="cpm" width={camp.colWidths.cpm} onResize={camp.startResize("cpm")} sortable sortableKey="cpm" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPM</ResizableHead>}
                        {showColumn("clicks") && <ResizableHead colKey="clicks" width={camp.colWidths.clicks} onResize={camp.startResize("clicks")} sortable sortableKey="clicks" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Cliques no link</ResizableHead>}
                        {showColumn("ctr") && <ResizableHead colKey="ctr" width={camp.colWidths.ctr} onResize={camp.startResize("ctr")} sortable sortableKey="ctr" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CTR</ResizableHead>}
                        {showColumn("cpc") && <ResizableHead colKey="cpc" width={camp.colWidths.cpc} onResize={camp.startResize("cpc")} sortable sortableKey="cpc" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPC</ResizableHead>}
                        {showColumn("leads") && <ResizableHead colKey="leads" width={camp.colWidths.leads} onResize={camp.startResize("leads")} sortable sortableKey="leads" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Resultados</ResizableHead>}
                        {showColumn("cpl") && <ResizableHead colKey="cpl" width={camp.colWidths.cpl} onResize={camp.startResize("cpl")} sortable sortableKey="cpl" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Custo por resultado</ResizableHead>}
                        {showColumn("conversion") && <ResizableHead colKey="conversion" width={camp.colWidths.conversion} onResize={camp.startResize("conversion")} sortable sortableKey="conversionRate" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Taxa de conversão</ResizableHead>}
                        {showColumn("sales") && <ResizableHead colKey="sales" width={camp.colWidths.sales} onResize={camp.startResize("sales")} sortable sortableKey="salesCount" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Vendas</ResizableHead>}
                        {showColumn("cpa") && <ResizableHead colKey="cpa" width={camp.colWidths.cpa} onResize={camp.startResize("cpa")} sortable sortableKey="cpa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">CPA</ResizableHead>}
                        {showColumn("revenue") && <ResizableHead colKey="revenue" width={camp.colWidths.revenue} onResize={camp.startResize("revenue")} sortable sortableKey="revenue" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Valor de conversão</ResizableHead>}
                        {showColumn("roas") && <ResizableHead colKey="roas" width={camp.colWidths.roas} onResize={camp.startResize("roas")} sortable sortableKey="roas" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">ROAS</ResizableHead>}
                        {showColumn("profit") && <ResizableHead colKey="profit" width={camp.colWidths.profit} onResize={camp.startResize("profit")} sortable sortableKey="profit" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">Lucro</ResizableHead>}
                        {showColumn("roi") && <ResizableHead colKey="roi" width={camp.colWidths.roi} onResize={camp.startResize("roi")} sortable sortableKey="roi" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} align="right">ROI</ResizableHead>}
                        {showColumn("videoViews") && <ResizableHead colKey="videoViews" width={camp.colWidths.videoViews} onResize={camp.startResize("videoViews")} align="right">Reproduções de vídeo</ResizableHead>}
                        <ResizableHead colKey="actions" width={camp.colWidths.actions} onResize={camp.startResize("actions")}>{""}</ResizableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {pagedCampaigns.map((c: any, rowIndex: number) => {
                          const stickySurface = selectedIds.has(c.id) ? "bg-accent" : rowIndex % 2 ? "bg-muted" : "bg-card";
                          return (
                          <motion.tr
                            key={c.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`group h-12 cursor-pointer border-b border-border transition-colors hover:bg-primary/5 ${selectedIds.has(c.id) ? "bg-primary/10" : "odd:bg-card even:bg-muted/20"}`}
                            onClick={() => setDetailCampaignId(c.id)}
                          >
                            <TableCell style={{ ...cellW("check"), left: 0 }} className={cn("sticky z-20 transition-colors group-hover:bg-accent", stickySurface)} onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                            </TableCell>
                            <TableCell style={{ ...cellW("delivery"), left: camp.colWidths.check }} className={cn("sticky z-20 transition-colors group-hover:bg-accent", stickySurface)} onClick={(event) => event.stopPropagation()}>
                              <div className={cn("flex items-center gap-2 text-xs font-semibold", getStatusBadge(c.status).textColor)}>
                                <button
                                  type="button"
                                  onClick={() => setEditingEntity({ type: "campaign", id: c.id, name: c.name, status: c.status })}
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
                                <span>{getStatusBadge(c.status).label}</span>
                              </div>
                            </TableCell>
                            <TableCell style={{ ...cellW("name"), left: camp.colWidths.check + camp.colWidths.delivery }} className={cn("sticky z-20 border-r border-border/80 font-medium shadow-[8px_0_14px_-14px_rgba(0,0,0,.85)] transition-colors group-hover:bg-accent", stickySurface)}>
                              <div className="flex min-w-0 items-center gap-2">
                                <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="truncate font-semibold text-foreground" title={c.name}>{c.name}</span>
                              </div>
                            </TableCell>
                            {showColumn("objective") && <TableCell style={cellW("objective")} className="truncate text-xs text-muted-foreground" title={c.objective || "Não informado"}>{c.objective || "—"}</TableCell>}
                            {showColumn("budget") && <TableCell style={cellW("budget")} className={cn("text-right tabular-nums text-sm", sortBg("budget"))}><AnimatedNumber value={c.budget} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("spend") && <TableCell style={cellW("spend")} className={cn("text-right tabular-nums text-sm", sortBg("spend"))}><AnimatedNumber value={c.spend} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("impressions") && <TableCell style={cellW("impressions")} className={cn("text-right tabular-nums text-sm", sortBg("impressions"))}><AnimatedNumber value={c.impressions} decimals={0} /></TableCell>}
                            {showColumn("reach") && <TableCell style={cellW("reach")} className={cn("text-right tabular-nums text-sm", sortBg("reach"))}><AnimatedNumber value={c.reach} decimals={0} /></TableCell>}
                            {showColumn("frequency") && <TableCell style={cellW("frequency")} className={cn("text-right tabular-nums text-sm", sortBg("frequency"))}><AnimatedNumber value={c.frequency} decimals={2} /></TableCell>}
                            {showColumn("cpm") && <TableCell style={cellW("cpm")} className={cn("text-right tabular-nums text-sm", sortBg("cpm"))}><AnimatedNumber value={c.cpm} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("clicks") && <TableCell style={cellW("clicks")} className={cn("text-right tabular-nums text-sm", sortBg("clicks"))}><AnimatedNumber value={c.clicks} decimals={0} /></TableCell>}
                            {showColumn("ctr") && <TableCell style={cellW("ctr")} className={cn("text-right tabular-nums text-sm", sortBg("ctr"))}><AnimatedNumber value={c.ctr} suffix="%" decimals={2} /></TableCell>}
                            {showColumn("cpc") && <TableCell style={cellW("cpc")} className={cn("text-right tabular-nums text-sm", sortBg("cpc"))}><AnimatedNumber value={c.cpc} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("leads") && <TableCell style={cellW("leads")} className={cn("text-right tabular-nums text-sm", sortBg("leads"))}><AnimatedNumber value={c.leads} decimals={0} /><span className="block text-[8px] text-muted-foreground">Lead da Meta</span></TableCell>}
                            {showColumn("cpl") && <TableCell style={cellW("cpl")} className={cn("text-right tabular-nums text-sm", sortBg("cpl"))}><AnimatedNumber value={c.cpl} prefix="R$ " decimals={2} /><span className="block text-[8px] text-muted-foreground">Por lead</span></TableCell>}
                            {showColumn("conversion") && <TableCell style={cellW("conversion")} className={cn("text-right tabular-nums text-sm", sortBg("conversionRate"))}><AnimatedNumber value={c.conversionRate} suffix="%" decimals={2} /></TableCell>}
                            {showColumn("sales") && <TableCell style={cellW("sales")} className={cn("text-right tabular-nums text-sm", sortBg("salesCount"))}><AnimatedNumber value={c.salesCount} decimals={0} /></TableCell>}
                            {showColumn("cpa") && <TableCell style={cellW("cpa")} className={cn("text-right tabular-nums text-sm", sortBg("cpa"))}><AnimatedNumber value={c.cpa} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("revenue") && <TableCell style={cellW("revenue")} className={cn("text-right tabular-nums text-sm", sortBg("revenue"))}><AnimatedNumber value={c.revenue} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("roas") && <TableCell style={cellW("roas")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.roas), sortBg("roas"))}><AnimatedNumber value={c.roas} suffix="x" decimals={2} /></TableCell>}
                            {showColumn("profit") && <TableCell style={cellW("profit")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.profit), sortBg("profit"))}><AnimatedNumber value={c.profit} prefix="R$ " decimals={2} /></TableCell>}
                            {showColumn("roi") && <TableCell style={cellW("roi")} className={cn("text-right tabular-nums text-sm font-semibold", colorClass(c.roi), sortBg("roi"))}><AnimatedNumber value={c.roi} suffix="%" decimals={1} /></TableCell>}
                            {showColumn("videoViews") && <TableCell style={cellW("videoViews")} className="text-right text-sm text-muted-foreground">—<span className="block text-[8px]">não sincronizado</span></TableCell>}
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
                        );})}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
                <div className="sticky bottom-0 z-20 border-t border-primary/20 bg-card/95 px-3 py-3 shadow-[0_-10px_28px_rgba(0,0,0,.12)] backdrop-blur-xl">
                  <div className="growdash-scrollbar flex min-w-0 gap-2 overflow-x-auto pb-1">
                    <TotalMetric label={`Totais (${filtered.length})`} value={`${filtered.length} campanhas`} />
                    <TotalMetric label="Orçamento" value={totals.budget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <TotalMetric label="Investimento" value={totals.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <TotalMetric label="Impressões" value={totals.impressions.toLocaleString("pt-BR")} />
                    <TotalMetric label="Cliques" value={totals.clicks.toLocaleString("pt-BR")} />
                    <TotalMetric label="CTR" value={`${totalCtr.toFixed(2).replace(".", ",")}%`} />
                    <TotalMetric label="CPC" value={totalCpc.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <TotalMetric label="CPM" value={totalCpm.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <TotalMetric label="Leads" value={totals.leads.toLocaleString("pt-BR")} />
                    <TotalMetric label="Vendas" value={totals.salesCount.toLocaleString("pt-BR")} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-3"><span className="text-[10px] text-muted-foreground">Exibindo {filtered.length ? campaignPage * pageSize + 1 : 0}–{Math.min((campaignPage + 1) * pageSize, filtered.length)} de {filtered.length}; 50 por página para reduzir renderização.</span><div className="flex items-center gap-1"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCampaignPage((page) => Math.max(0, page - 1))} disabled={campaignPage === 0}><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="min-w-20 text-center text-[10px]">Página {campaignPage + 1} de {pageCount}</span><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCampaignPage((page) => Math.min(pageCount - 1, page + 1))} disabled={campaignPage + 1 >= pageCount}><ChevronRight className="h-3.5 w-3.5" /></Button></div></div>
                  {(showColumn("reach") || showColumn("frequency")) && <p className="mt-2 text-[9px] text-muted-foreground">* Alcance soma linhas diárias por anúncio e pode repetir pessoas; a frequência é direcional até a sincronização de alcance deduplicado por período.</p>}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Adsets Tab */}
          <TabsContent value="adsets" className="m-0">
            <Card className="overflow-hidden rounded-none border-0 shadow-none">
              {isLoadingAdsets ? <LevelLoading /> : selectedAdsets.length === 0 ? <LevelEmpty level="conjuntos de anúncios" selected={selectedIds.size > 0} onClear={() => setSelectedIds(new Set())} /> : <>
              <div className="space-y-2 p-2 md:hidden">{selectedAdsets.map((entity: any) => <LevelMobileCard key={entity.id} entity={{ ...entity, type: "adset" }} onOpen={() => setDetailEntity({ ...entity, type: "adset" })} />)}</div>
              <div className="growdash-scrollbar hidden overflow-x-auto md:block">
                <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                  <TableHeader>
                    <TableRow className="h-11 bg-muted/60 hover:bg-muted/60">
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
          <TabsContent value="ads" className="m-0">
            <Card className="overflow-hidden rounded-none border-0 shadow-none">
              {isLoadingAds ? <LevelLoading /> : selectedAds.length === 0 ? <LevelEmpty level="anúncios" selected={selectedIds.size > 0} onClear={() => setSelectedIds(new Set())} /> : <>
              <div className="space-y-2 p-2 md:hidden">{selectedAds.map((entity: any) => <LevelMobileCard key={entity.id} entity={{ ...entity, type: "ad" }} onOpen={() => setDetailEntity({ ...entity, type: "ad" })} />)}</div>
              <div className="growdash-scrollbar hidden overflow-x-auto md:block">
                <Table style={{ tableLayout: "fixed", width: "max-content" }}>
                  <TableHeader>
                    <TableRow className="h-11 bg-muted/60 hover:bg-muted/60">
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
        onEdit={(campaign) => { setDetailCampaignId(null); setEditingEntity({ type: "campaign", id: campaign.id, name: campaign.name, status: campaign.status }); }}
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
    </MotionPage>
  );
}

function CampaignIntelligence({ totals, totalCtr, totalCpc, totalCpm, totalCpl, totalRoas, totalResultRate, series, accountId, accountName, startDate, endDate, selectedCampaignIds }: {
  totals: any;
  totalCtr: number;
  totalCpc: number;
  totalCpm: number;
  totalCpl: number;
  totalRoas: number;
  totalResultRate: number;
  series: any[];
  accountId: string;
  accountName?: string;
  startDate: Date;
  endDate: Date;
  selectedCampaignIds: string[];
}) {
  const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const tooltipStyle = { borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))", fontSize: 11 };
  return (
    <section className="border-b border-primary/20 bg-muted/15">
      <header className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black"><BrainCircuit className="h-4 w-4 text-primary" />Growdash Intelligence</h2>
          <p className="text-[10px] text-muted-foreground">Diagnóstico quantitativo da entrega, eficiência e resultado no período selecionado.</p>
        </div>
        <Badge variant="outline" className="w-fit">{series.length} dia(s) com dados</Badge>
      </header>

      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-5">
        <AnalysisMetric label="Impressões" value={totals.impressions.toLocaleString("pt-BR")} />
        <AnalysisMetric label="CTR" value={`${totalCtr.toFixed(2).replace(".", ",")}%`} />
        <AnalysisMetric label="Investimento" value={currency(totals.spend)} />
        <AnalysisMetric label="Leads" value={totals.leads.toLocaleString("pt-BR")} />
        <AnalysisMetric label="CPL" value={currency(totalCpl)} />
        <AnalysisMetric label="ROAS" value={`${totalRoas.toFixed(2).replace(".", ",")}x`} />
        <AnalysisMetric label="CPM" value={currency(totalCpm)} />
        <AnalysisMetric label="Cliques" value={totals.clicks.toLocaleString("pt-BR")} />
        <AnalysisMetric label="CPC" value={currency(totalCpc)} />
        <AnalysisMetric label="Taxa de resultado" value={`${totalResultRate.toFixed(2).replace(".", ",")}%`} />
      </div>

      {series.length > 0 ? (
        <div className="grid gap-3 border-t border-border p-3 xl:grid-cols-2">
          <ChartPanel title="Investimento × leads" description="Evolução diária com duas escalas para não distorcer volume e custo.">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
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
              <RechartsLineChart data={series} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
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
      ) : (
        <div className="border-t border-border p-8 text-center text-xs text-muted-foreground">Sincronize insights diários da Meta para habilitar os gráficos de evolução.</div>
      )}

      <div className="border-t border-border">
        <TrafficAIAnalysis accountId={accountId} accountName={accountName} startDate={startDate} endDate={endDate} selectedCampaignIds={selectedCampaignIds} />
      </div>
    </section>
  );
}

function ChartPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <article className="min-w-0 rounded-xl border border-border bg-card p-4"><h3 className="text-xs font-black">{title}</h3><p className="mt-1 text-[9px] text-muted-foreground">{description}</p><div className="mt-4 h-[260px] min-w-0">{children}</div></article>;
}

function TotalMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-[118px] shrink-0 rounded-lg border border-border/70 bg-muted/35 px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-0.5 block whitespace-nowrap text-xs tabular-nums">{value}</strong></div>;
}

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card px-3 py-2"><span className="block text-[8px] font-black uppercase tracking-wide text-muted-foreground">{label}</span><strong className="mt-1 block text-sm tabular-nums">{value}</strong></div>;
}

function AnalysisCampaignAlert({ campaign, health, targetCpl, accountName, onOpen }: { campaign: any; health: CampaignHealth; targetCpl: number; accountName: string; onOpen: () => void }) {
  const option = HEALTH_OPTIONS.find((item) => item.id === health)!;
  const days = getCampaignActiveDays(campaign.created_at);
  return (
    <button type="button" onClick={onOpen} className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.025] hover:shadow-md">
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
  return <div className="sticky bottom-0 z-20 border-t border-primary/20 bg-card/95 px-3 py-3 shadow-[0_-10px_28px_rgba(0,0,0,.12)] backdrop-blur-xl"><div className="growdash-scrollbar flex gap-2 overflow-x-auto"><TotalMetric label="Total" value={`${count} ${label}`} /><TotalMetric label="Investimento" value={totals.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><TotalMetric label="Impressões" value={totals.impressions.toLocaleString("pt-BR")} /><TotalMetric label="Alcance*" value={totals.reach.toLocaleString("pt-BR")} /><TotalMetric label="Cliques" value={totals.clicks.toLocaleString("pt-BR")} /><TotalMetric label="CTR" value={`${ctr.toFixed(2).replace(".", ",")}%`} /><TotalMetric label="Resultados" value={totals.leads.toLocaleString("pt-BR")} /><TotalMetric label="CPL" value={cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /></div></div>;
}

function exportCsv(header: string[], rows: Array<Array<string | number>>, filename: string) {
  const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
