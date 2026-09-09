import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RDDeal } from "@/hooks/useRDDeals";

type BreakdownType = "age" | "gender" | "publisher_platform" | "platform_position" | "country" | "region";
type Segment = { key: string; leads: number; spend: number; impressions: number; clicks: number };

const breakdowns: ReadonlyArray<{ type: BreakdownType; title: string; description: string }> = [
  { type: "age", title: "Faixa etária", description: "Distribuição por idade estimada pela Meta." },
  { type: "gender", title: "Gênero", description: "Distribuição de entrega por gênero reportada pela Meta." },
  { type: "publisher_platform", title: "Plataforma", description: "Facebook, Instagram, Messenger ou Audience Network." },
  { type: "platform_position", title: "Posicionamento", description: "Posições de veiculação, como Feed, Stories e Reels." },
  { type: "country", title: "País", description: "País da entrega reportado pela Meta." },
  { type: "region", title: "Região", description: "Estado ou região da entrega reportada pela Meta." },
];

function aggregate(rows: any[]): Segment[] {
  const map = new Map<string, Segment>();
  for (const row of rows) {
    const key = String(row.segment_key || "Não informado");
    const current = map.get(key) || { key, leads: 0, spend: 0, impressions: 0, clicks: 0 };
    current.leads += Number(row.leads || 0);
    current.spend += Number(row.spend || 0);
    current.impressions += Number(row.impressions || 0);
    current.clicks += Number(row.clicks || 0);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads || b.spend - a.spend || b.impressions - a.impressions);
}

function MetaBreakdown({ title, description, rows, loading }: { title: string; description: string; rows: Segment[]; loading: boolean }) {
  const totalLeads = rows.reduce((sum, row) => sum + row.leads, 0);
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  if (!rows.length) return <section className="rounded-lg border border-border/60 p-4"><h3 className="text-sm font-semibold">{title} <span className="text-xs font-normal text-muted-foreground">· Meta</span></h3><p className="mt-1 text-xs text-muted-foreground">{description}</p><p className="py-5 text-xs text-muted-foreground">{loading ? "Carregando dados da Meta…" : "Sem detalhamento sincronizado neste período."}</p></section>;
  return <section className="rounded-lg border border-border/60 p-4"><h3 className="text-sm font-semibold">{title} <span className="text-xs font-normal text-muted-foreground">· Meta</span></h3><p className="mt-1 text-xs text-muted-foreground">{description}</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[430px] text-left text-xs"><thead className="border-b text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="pb-2 font-medium">Segmento</th><th className="pb-2 text-right font-medium">Leads</th><th className="pb-2 text-right font-medium">Participação</th><th className="pb-2 text-right font-medium">Investido</th><th className="pb-2 text-right font-medium">CPL</th><th className="pb-2 text-right font-medium">CTR</th></tr></thead><tbody>{rows.slice(0, 10).map((row) => { const cpl = row.leads ? row.spend / row.leads : null; const ctr = row.impressions ? (row.clicks / row.impressions) * 100 : null; return <tr key={row.key} className="border-b border-border/40 last:border-0"><td className="max-w-36 truncate py-2 pr-3 font-medium" title={row.key}>{row.key}</td><td className="py-2 text-right tabular-nums">{row.leads.toLocaleString("pt-BR")}</td><td className="py-2 text-right tabular-nums text-muted-foreground">{totalLeads ? `${((row.leads / totalLeads) * 100).toFixed(1)}%` : "—"}</td><td className="py-2 text-right tabular-nums">{row.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="py-2 text-right tabular-nums">{cpl === null ? "—" : cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="py-2 text-right tabular-nums">{ctr === null ? "—" : `${ctr.toFixed(2)}%`}</td></tr>; })}</tbody></table></div><p className="mt-3 text-[10px] text-muted-foreground">{totalLeads.toLocaleString("pt-BR")} leads atribuídos · {totalSpend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} investidos.</p></section>;
}

export function FunnelAudienceProfile({ deals, campaignIds, startDate, endDate }: { deals: RDDeal[]; campaignIds: string[]; startDate: Date; endDate: Date }) {
  const breakdownQuery = useQuery({
    queryKey: ["funnel-audience-breakdowns", campaignIds.slice().sort().join(","), format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("insights_breakdowns").select("breakdown_type, segment_key, leads, spend, impressions, clicks, date").in("campaign_id", campaignIds).in("breakdown_type", breakdowns.map((item) => item.type)).gte("date", format(startDate, "yyyy-MM-dd")).lte("date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      const rows = data || [];
      return Object.fromEntries(breakdowns.map((item) => [item.type, aggregate(rows.filter((row: any) => row.breakdown_type === item.type))])) as Record<BreakdownType, Segment[]>;
    },
    staleTime: 15 * 60 * 1000,
  });

  const locations = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of deals) { const city = String(deal.lead_city || "").trim(); const state = String(deal.lead_state || "").trim(); const key = city && state ? `${city} · ${state}` : city || state || "Não informado"; map.set(key, (map.get(key) || 0) + 1); }
    return [...map.entries()].map(([key, leads]) => ({ key, leads })).sort((a, b) => b.leads - a.leads);
  }, [deals]);
  const located = locations.filter((row) => row.key !== "Não informado").reduce((sum, row) => sum + row.leads, 0);

  return <Card className="gd-analysis-card border-border/40 bg-card/60"><CardHeader><CardTitle className="text-base">Perfil do público e entrega</CardTitle><p className="text-xs font-normal text-muted-foreground">Todos os recortes disponíveis da Meta para as campanhas e período selecionados, acompanhados de leads, investimento, CPL e CTR.</p></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border border-primary/20 bg-primary/[0.035] px-3 py-2 text-[11px] text-muted-foreground">Os dados da Meta mostram a entrega e as conversões atribuídas por segmento; eles não identificam pessoas individualmente nem provam a idade declarada no RD. Use “Sincronizar Meta + RD” para buscar o período atual.</div><section className="rounded-lg border border-border/60 p-4"><h3 className="text-sm font-semibold">Localização dos cadastros <span className="text-xs font-normal text-muted-foreground">· RD</span></h3><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">{locations.slice(0, 10).map((row) => <span key={row.key}><b>{row.key}</b> · {row.leads.toLocaleString("pt-BR")}</span>)}</div><p className="mt-3 text-[10px] text-muted-foreground">{deals.length.toLocaleString("pt-BR")} cadastros analisados · {deals.length ? `${((located / deals.length) * 100).toFixed(1)}% com cidade ou estado informado` : "sem cadastros no período"}.</p></section><div className="grid gap-4 xl:grid-cols-2">{breakdowns.map((item) => <MetaBreakdown key={item.type} {...item} rows={breakdownQuery.data?.[item.type] || []} loading={breakdownQuery.isLoading} />)}</div></CardContent></Card>;
}
