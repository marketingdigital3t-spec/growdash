import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { parseISO, format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useDashboard } from "@/contexts/DashboardContext";
import { usePlatformRules } from "@/hooks/usePlatformRules";
import { inferPlatform, subOriginLabel, type TopPlatform } from "@/lib/platformInference";
import { attributeSalesToAds } from "@/lib/salesAttribution";
import { SaleDetailSheet } from "@/components/dashboard/SaleDetailSheet";
import type { Sale } from "@/hooks/useSales";

interface Props {
  platform: TopPlatform | null;
  onClose: () => void;
}

function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  try { return format(parseISO(s), "dd/MM/yyyy"); } catch { return "—"; }
}

function SaleLine({ s, onClick }: { s: Sale; onClick: (s: Sale) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(s)}
      className="w-full flex items-center justify-between gap-3 py-2 border-b last:border-0 text-xs text-left hover:bg-muted/40 -mx-3 px-3 transition-colors cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{s.contact_name || "—"}</p>
        <p className="text-muted-foreground truncate">
          {[s.utm_source, s.rd_campaign_name].filter(Boolean).join(" / ") || "sem origem"} · {fmtDate(s.sale_date)}
        </p>
      </div>
      <span className="tabular-nums font-semibold whitespace-nowrap">{fmtBRL(s.net_revenue)}</span>
    </button>
  );
}

export function PlatformDrilldownSheet({ platform, onClose }: Props) {
  const { sales, insights } = useDashboard();
  const { data: rules = [] } = usePlatformRules();
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [openSale, setOpenSale] = useState<Sale | null>(null);

  const confirmed = useMemo(
    () => sales.filter((s) => s.status === "confirmed" || s.status === "pending"),
    [sales]
  );

  const platformSales = useMemo(
    () => confirmed.filter((s) => inferPlatform(s, rules).platform === platform),
    [confirmed, rules, platform]
  );

  const totalRev = platformSales.reduce((a, s) => a + s.net_revenue, 0);
  const totalCount = platformSales.length;

  const orgBreakdown = useMemo(() => {
    if (platform !== "organic") return [];
    const acc: Record<string, { count: number; rev: number; sales: Sale[] }> = {};
    platformSales.forEach((s) => {
      const sub = inferPlatform(s, rules).subOrigin ?? "outros";
      if (!acc[sub]) acc[sub] = { count: 0, rev: 0, sales: [] };
      acc[sub].count += 1;
      acc[sub].rev += s.net_revenue;
      acc[sub].sales.push(s);
    });
    return Object.entries(acc)
      .map(([k, v]) => ({ key: k, label: subOriginLabel(k), ...v }))
      .sort((a, b) => b.rev - a.rev);
  }, [platform, platformSales, rules]);

  const metaAttribution = useMemo(() => {
    if (platform !== "meta") return null;
    return attributeSalesToAds(platformSales, insights);
  }, [platform, platformSales, insights]);

  const metaBreakdown = useMemo(() => {
    if (!metaAttribution) return [];
    const adInfo = new Map(insights.map((r) => [r.ad_id, r]));
    return Array.from(metaAttribution.matched.entries())
      .map(([adId, list]) => {
        const info = adInfo.get(adId)!;
        const rev = list.reduce((a: number, s: Sale) => a + s.net_revenue, 0);
        return {
          adId,
          campaign: info?.campaign_name ?? "—",
          adset: info?.adset_name ?? "—",
          ad: info?.ad_name ?? "—",
          thumb: info?.thumbnail_url,
          count: list.length,
          rev,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [metaAttribution, insights]);

  return (
    <Sheet open={!!platform} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {platform === "meta" && "Meta — Detalhamento por Anúncio"}
            {platform === "google" && "Google"}
            {platform === "organic" && "Orgânico — Sub-origens"}
          </SheetTitle>
          <SheetDescription>
            {totalCount} vendas · {fmtBRL(totalRev)} no período
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {platform === "google" && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Integração com Google Ads ainda não vinculada.
            </div>
          )}

          {platform === "organic" && orgBreakdown.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem vendas orgânicas no período.</p>
          )}

          {platform === "organic" && orgBreakdown.map((o) => {
            const pct = totalRev > 0 ? (o.rev / totalRev) * 100 : 0;
            const open = expandedSub === o.key;
            return (
              <div key={o.key} className="rounded-lg border overflow-hidden">
                <button
                  onClick={() => setExpandedSub(open ? null : o.key)}
                  className="w-full p-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-1.5">
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {o.label}
                    </span>
                    <span className="tabular-nums">{fmtBRL(o.rev)} ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{o.count} vendas · clique para detalhar</p>
                </button>
                {open && (
                  <div className="px-3 pb-3 border-t bg-muted/20">
                    {o.sales.map((s) => <SaleLine key={s.id} s={s} onClick={setOpenSale} />)}
                  </div>
                )}
              </div>
            );
          })}

          {platform === "meta" && metaBreakdown.length === 0 && (!metaAttribution || metaAttribution.unmatched.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhuma venda atribuída a anúncios Meta no período.</p>
          )}

          {platform === "meta" && metaBreakdown.map((m, idx) => {
            const pct = totalRev > 0 ? (m.rev / totalRev) * 100 : 0;
            return (
              <div key={m.adId} className={`rounded-lg border p-3 flex gap-3 ${idx === 0 ? "border-primary/50 bg-primary/5" : ""}`}>
                {m.thumb ? (
                  <img src={m.thumb} alt="" className="h-14 w-14 rounded object-cover border flex-shrink-0" />
                ) : (
                  <div className="h-14 w-14 rounded bg-muted border flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={m.ad}>{m.ad}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.campaign} · {m.adset}</p>
                  <div className="flex justify-between items-center mt-1 text-xs">
                    <span>{m.count} vendas · {pct.toFixed(1)}%</span>
                    <span className="tabular-nums font-semibold">{fmtBRL(m.rev)}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {platform === "meta" && metaAttribution && metaAttribution.unmatched.length > 0 && (
            <div className="rounded-lg border border-dashed overflow-hidden">
              <button
                onClick={() => setExpandedSub(expandedSub === "__unmatched" ? null : "__unmatched")}
                className="w-full p-3 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-1.5">
                    {expandedSub === "__unmatched" ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    Vendas sem anúncio identificado
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {metaAttribution.unmatched.length} · {fmtBRL(metaAttribution.unmatched.reduce((a, s) => a + s.net_revenue, 0))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  UTM não casou com nenhuma campanha sincronizada. Defina manualmente em Vendas RD se necessário.
                </p>
              </button>
              {expandedSub === "__unmatched" && (
                <div className="px-3 pb-3 border-t bg-muted/20">
                  {metaAttribution.unmatched.map((s) => <SaleLine key={s.id} s={s} onClick={setOpenSale} />)}
                </div>
              )}
            </div>
          )}
        </div>

        <SaleDetailSheet sale={openSale} onClose={() => setOpenSale(null)} />
      </SheetContent>
    </Sheet>
  );
}
