import { useEffect, useMemo, useRef, useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { getHealthBadge } from "@/lib/metrics";
import { getStatusBadge } from "@/lib/status";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { cn } from "@/lib/utils";
import type { InsightRow } from "@/hooks/useInsights";
import { useDashboard } from "@/contexts/DashboardContext";
import { attributeSalesToAds } from "@/lib/salesAttribution";

interface InsightsTableProps {
  data: InsightRow[];
}

type SortKey = keyof InsightRow | "vendas" | "cpv";

type ColKey =
  | "campaign" | "adset" | "ad" | "vendas" | "cpv" | "spend" | "leads" | "cpl" | "ctr"
  | "cpm" | "impressions" | "clicks" | "frequency" | "conversion_rate" | "score";

const DEFAULT_WIDTHS: Record<ColKey, number> = {
  campaign: 220, adset: 180, ad: 280,
  vendas: 90, cpv: 130,
  spend: 120, leads: 90, cpl: 110, ctr: 100, cpm: 110,
  impressions: 120, clicks: 100, frequency: 100, conversion_rate: 110, score: 110,
};

const STORAGE_KEY = "insights-table-cols-v2";

export function InsightsTable({ data }: InsightsTableProps) {
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTHS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_WIDTHS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_WIDTHS;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  const resizingRef = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);

  const startResize = (key: ColKey) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { key, startX: e.clientX, startW: colWidths[key] };
    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(70, r.startW + (ev.clientX - r.startX));
      setColWidths((w) => ({ ...w, [r.key]: next }));
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const campaigns = useMemo(() => [...new Set(data.map((r) => r.campaign_name))], [data]);

  const { sales } = useDashboard();
  const salesByAd = useMemo(() => attributeSalesToAds(sales, data).matched, [sales, data]);

  // Aggregate by ad
  const aggregated = useMemo(() => {
    const map = new Map<string, InsightRow & { count: number; vendas: number; cpv: number }>();
    for (const r of data) {
      const key = r.ad_id;
      const existing = map.get(key);
      if (existing) {
        existing.spend += r.spend;
        existing.leads += r.leads;
        existing.clicks += r.clicks;
        existing.impressions += r.impressions;
        existing.count += 1;
        existing.frequency = (existing.frequency * (existing.count - 1) + r.frequency) / existing.count;
        existing.ctr = existing.impressions > 0 ? (existing.clicks / existing.impressions) * 100 : 0;
        existing.cpm = existing.impressions > 0 ? (existing.spend / existing.impressions) * 1000 : 0;
        existing.cpl = existing.leads > 0 ? existing.spend / existing.leads : 0;
        existing.conversion_rate = existing.clicks > 0 ? (existing.leads / existing.clicks) * 100 : 0;
        existing.efficiency_rate = existing.impressions > 0 ? (existing.leads / existing.impressions) * 100 : 0;
        existing.health_score = (existing.ctr * 2) + (existing.conversion_rate * 3) - (existing.cpl * 2);
      } else {
        map.set(key, { ...r, count: 1, vendas: 0, cpv: 0 });
      }
    }
    // Apply sales attribution
    for (const row of map.values()) {
      const list = salesByAd.get(row.ad_id) || [];
      row.vendas = list.length;
      row.cpv = row.vendas > 0 ? row.spend / row.vendas : 0;
    }
    return Array.from(map.values());
  }, [data, salesByAd]);

  const filtered = useMemo(() => {
    let result = aggregated;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.ad_name.toLowerCase().includes(s) ||
          r.adset_name.toLowerCase().includes(s) ||
          r.campaign_name.toLowerCase().includes(s)
      );
    }
    if (campaignFilter !== "all") {
      result = result.filter((r) => r.campaign_name === campaignFilter);
    }
    if (statusFilter !== "all") {
      const norm = (s?: string | null) => {
        const u = (s || "").toUpperCase();
        if (u === "CAMPAIGN_PAUSED" || u === "ADSET_PAUSED") return "PAUSED";
        if (u === "PENDING_REVIEW") return "IN_PROCESS";
        return u;
      };
      result = result.filter((r) =>
        [r.campaign_status, r.adset_status, r.ad_status].some((s) => norm(s) === statusFilter)
      );
    }
    result.sort((a, b) => {
      const aVal = a[sortKey] as number;
      const bVal = b[sortKey] as number;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [aggregated, search, campaignFilter, statusFilter, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const exportCSV = () => {
    const headers = ["Campanha", "Conjunto", "Anúncio", "Vendas", "Custo/Venda", "Investido", "Leads", "CPL", "CTR%", "CPM", "Impressões", "Cliques", "Frequência", "Conversão%", "Score"];
    const rows = filtered.map((r) =>
      [r.campaign_name, r.adset_name, r.ad_name, r.vendas, r.cpv.toFixed(2), r.spend.toFixed(2), r.leads, r.cpl.toFixed(2), r.ctr.toFixed(2), r.cpm.toFixed(2), r.impressions, r.clicks, r.frequency.toFixed(2), r.conversion_rate.toFixed(2), r.health_score.toFixed(0)].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "insights.csv";
    a.click();
  };

  const ResizableHead = ({
    colKey, children, sortable, sortableKey, className,
  }: {
    colKey: ColKey;
    children: React.ReactNode;
    sortable?: boolean;
    sortableKey?: SortKey;
    className?: string;
  }) => {
    const isActive = sortable && sortableKey === sortKey;
    return (
      <TableHead
        style={{ width: colWidths[colKey], minWidth: colWidths[colKey], maxWidth: colWidths[colKey] }}
        className={cn(
          "relative select-none group",
          isActive && "bg-primary/5 text-foreground",
          sortable && "cursor-pointer",
          className,
        )}
        onClick={sortable && sortableKey ? () => handleSort(sortableKey) : undefined}
      >
        <div className="flex items-center gap-1 pr-2 truncate">
          <span className={cn("truncate", isActive && "font-semibold")}>{children}</span>
          {sortable && (
            isActive ? (
              sortAsc
                ? <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                : <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )
          )}
        </div>
        <span
          onMouseDown={startResize(colKey)}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
          title="Arrastar para redimensionar"
        />
      </TableHead>
    );
  };

  const StatusDot = ({ status }: { status?: string | null }) => {
    const b = getStatusBadge(status);
    return (
      <span
        className={cn("h-2 w-2 rounded-full shrink-0", b.dotColor)}
        title={b.label}
      />
    );
  };

  const cellStyle = (k: ColKey) => ({
    width: colWidths[k],
    minWidth: colWidths[k],
    maxWidth: colWidths[k],
  });

  const isSaturated = (r: InsightRow & { count: number }) => r.frequency > 3 && r.ctr < 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar anúncio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card" />
        </div>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[200px] bg-card">
            <SelectValue placeholder="Todas campanhas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas campanhas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px] bg-card">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="ACTIVE">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ativa
              </span>
            </SelectItem>
            <SelectItem value="PAUSED">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Pausada
              </span>
            </SelectItem>
            <SelectItem value="ARCHIVED">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Arquivada
              </span>
            </SelectItem>
            <SelectItem value="IN_PROCESS">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Em análise
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setColWidths(DEFAULT_WIDTHS)}
          className="bg-card"
          title="Resetar largura das colunas"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} className="bg-card">
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
      </div>
      <div className="rounded-lg border bg-card overflow-auto max-h-[600px]">
        <Table style={{ tableLayout: "fixed", width: "max-content" }}>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <ResizableHead colKey="campaign">Campanha</ResizableHead>
              <ResizableHead colKey="adset">Conjunto</ResizableHead>
              <ResizableHead colKey="ad">Anúncio</ResizableHead>
              <ResizableHead colKey="vendas" sortable sortableKey={"vendas" as SortKey}>Vendas</ResizableHead>
              <ResizableHead colKey="cpv" sortable sortableKey={"cpv" as SortKey}>Custo/Venda</ResizableHead>
              <ResizableHead colKey="spend" sortable sortableKey="spend">Investido</ResizableHead>
              <ResizableHead colKey="leads" sortable sortableKey="leads">Leads</ResizableHead>
              <ResizableHead colKey="cpl" sortable sortableKey="cpl">CPL</ResizableHead>
              <ResizableHead colKey="ctr" sortable sortableKey="ctr">CTR%</ResizableHead>
              <ResizableHead colKey="cpm" sortable sortableKey="cpm">CPM</ResizableHead>
              <ResizableHead colKey="impressions" sortable sortableKey="impressions">Impressões</ResizableHead>
              <ResizableHead colKey="clicks" sortable sortableKey="clicks">Cliques</ResizableHead>
              <ResizableHead colKey="frequency" sortable sortableKey="frequency">Freq.</ResizableHead>
              <ResizableHead colKey="conversion_rate" sortable sortableKey="conversion_rate">Conv.%</ResizableHead>
              <ResizableHead colKey="score">Score</ResizableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                  Nenhum dado encontrado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const badge = getHealthBadge(r.health_score);
                const sortBg = (k: SortKey) => sortKey === k ? "bg-primary/5" : "";
                return (
                  <TableRow key={r.ad_id}>
                    <TableCell style={cellStyle("campaign")} className="text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={r.campaign_status} />
                        <span className="truncate" title={r.campaign_name}>{r.campaign_name}</span>
                      </div>
                    </TableCell>
                    <TableCell style={cellStyle("adset")} className="text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusDot status={r.adset_status} />
                        <span className="truncate" title={r.adset_name}>{r.adset_name}</span>
                      </div>
                    </TableCell>
                    <TableCell style={cellStyle("ad")} className="text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.thumbnail_url ? (
                          <img src={r.thumbnail_url} alt="" className="h-9 w-9 rounded object-cover border flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted border flex-shrink-0" />
                        )}
                        <StatusDot status={r.ad_status} />
                        <span className="truncate" title={r.ad_name}>
                          {r.ad_name}
                          {isSaturated(r) && <span className="ml-1 text-red-500" title="Possível Saturação">🚨</span>}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell style={cellStyle("vendas")} className={cn("tabular-nums", sortBg("vendas" as SortKey))}><AnimatedNumber value={r.vendas} decimals={0} duration={500} /></TableCell>
                    <TableCell style={cellStyle("cpv")} className={cn("tabular-nums", sortBg("cpv" as SortKey))}>{r.vendas > 0 ? <AnimatedNumber value={r.cpv} prefix="R$ " decimals={2} duration={500} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell style={cellStyle("spend")} className={cn("tabular-nums", sortBg("spend"))}><AnimatedNumber value={r.spend} prefix="R$ " decimals={2} duration={500} /></TableCell>
                    <TableCell style={cellStyle("leads")} className={cn("tabular-nums", sortBg("leads"))}><AnimatedNumber value={r.leads} decimals={0} duration={500} /></TableCell>
                    <TableCell style={cellStyle("cpl")} className={cn("tabular-nums", sortBg("cpl"))}><AnimatedNumber value={r.cpl} prefix="R$ " decimals={2} duration={500} /></TableCell>
                    <TableCell style={cellStyle("ctr")} className={cn("tabular-nums", sortBg("ctr"))}><AnimatedNumber value={r.ctr} suffix="%" decimals={2} duration={500} /></TableCell>
                    <TableCell style={cellStyle("cpm")} className={cn("tabular-nums", sortBg("cpm"))}><AnimatedNumber value={r.cpm} prefix="R$ " decimals={2} duration={500} /></TableCell>
                    <TableCell style={cellStyle("impressions")} className={cn("tabular-nums", sortBg("impressions"))}><AnimatedNumber value={r.impressions} decimals={0} duration={500} /></TableCell>
                    <TableCell style={cellStyle("clicks")} className={cn("tabular-nums", sortBg("clicks"))}><AnimatedNumber value={r.clicks} decimals={0} duration={500} /></TableCell>
                    <TableCell style={cellStyle("frequency")} className={cn("tabular-nums", sortBg("frequency"))}><AnimatedNumber value={r.frequency} decimals={2} duration={500} /></TableCell>
                    <TableCell style={cellStyle("conversion_rate")} className={cn("tabular-nums", sortBg("conversion_rate"))}><AnimatedNumber value={r.conversion_rate} suffix="%" decimals={2} duration={500} /></TableCell>
                    <TableCell style={cellStyle("score")}>
                      <Badge variant="outline" className={`text-[10px] ${badge.color}`}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
