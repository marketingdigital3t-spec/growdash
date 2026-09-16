/* eslint-disable react-refresh/only-export-components */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, Download, Minimize2 } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type BreakdownType = "age" | "gender" | "publisher_platform" | "platform_position" | "country" | "region";
export type AudienceSegment = { key: string; leads: number; spend: number; impressions: number; clicks: number };
export type AudienceLocation = { key: string; leads: number };
export type AudienceProfileData = { segments: Record<BreakdownType, AudienceSegment[]>; locations: AudienceLocation[]; registrations: number; locatedRegistrations: number };
type DealLocation = { lead_city?: string | null; lead_state?: string | null };

export const audienceBreakdowns: ReadonlyArray<{ type: BreakdownType; title: string; description: string }> = [
  { type: "age", title: "Faixa etária", description: "Distribuição por idade estimada pela Meta." },
  { type: "gender", title: "Gênero", description: "Distribuição de entrega por gênero reportada pela Meta." },
  { type: "publisher_platform", title: "Plataforma", description: "Facebook, Instagram, Messenger ou Audience Network." },
  { type: "platform_position", title: "Posicionamento", description: "Posições de veiculação, como Feed, Stories e Reels." },
  { type: "country", title: "País", description: "País da entrega reportado pela Meta." },
  { type: "region", title: "Região", description: "Estado ou região da entrega reportada pela Meta." },
];

function aggregate(rows: any[]): AudienceSegment[] {
  const map = new Map<string, AudienceSegment>();
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

export function useAudienceProfileData({ deals, campaignIds, accountIds = [], startDate, endDate }: { deals: DealLocation[]; campaignIds: string[]; accountIds?: string[]; startDate: Date; endDate: Date }) {
  const locations = useMemo(() => {
    const map = new Map<string, number>();
    for (const deal of deals) {
      const city = String(deal.lead_city || "").trim();
      const state = String(deal.lead_state || "").trim();
      const key = city && state ? `${city} · ${state}` : city || state || "Não informado";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].map(([key, leads]) => ({ key, leads })).sort((a, b) => b.leads - a.leads);
  }, [deals]);
  const locatedRegistrations = locations.filter((row) => row.key !== "Não informado").reduce((sum, row) => sum + row.leads, 0);
  const breakdownQuery = useQuery({
    queryKey: ["funnel-audience-breakdowns", campaignIds.slice().sort().join(","), accountIds.slice().sort().join(","), format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    enabled: campaignIds.length > 0 || accountIds.length > 0,
    queryFn: async () => {
      let scopedCampaignIds = [...campaignIds];
      if (!scopedCampaignIds.length && accountIds.length) {
        const { data, error } = await supabase.from("campaigns").select("id").in("ad_account_id", accountIds);
        if (error) throw error;
        scopedCampaignIds = (data || []).map((row: any) => String(row.id));
      }
      if (!scopedCampaignIds.length) return Object.fromEntries(audienceBreakdowns.map((item) => [item.type, []])) as Record<BreakdownType, AudienceSegment[]>;
      // Supabase/PostgREST caps responses at 1,000 rows by default. A broad
      // account/date selection can exceed that cap (6 breakdowns x days x
      // campaigns), silently dropping segments from the audience profile.
      const PAGE = 1000;
      const rows: any[] = [];
      for (let page = 0; ; page += 1) {
        const { data, error } = await (supabase as any)
          .from("insights_breakdowns")
          .select("breakdown_type, segment_key, leads, spend, impressions, clicks, date")
          .in("campaign_id", scopedCampaignIds)
          .in("breakdown_type", audienceBreakdowns.map((item) => item.type))
          .gte("date", format(startDate, "yyyy-MM-dd"))
          .lte("date", format(endDate, "yyyy-MM-dd"))
          .order("date", { ascending: true })
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      return Object.fromEntries(audienceBreakdowns.map((item) => [item.type, aggregate(rows.filter((row: any) => row.breakdown_type === item.type))])) as Record<BreakdownType, AudienceSegment[]>;
    },
    staleTime: 15 * 60 * 1000,
  });
  const data = useMemo<AudienceProfileData>(() => ({ segments: breakdownQuery.data || Object.fromEntries(audienceBreakdowns.map((item) => [item.type, []])) as Record<BreakdownType, AudienceSegment[]>, locations, registrations: deals.length, locatedRegistrations }), [breakdownQuery.data, deals.length, locatedRegistrations, locations]);
  return { ...breakdownQuery, data };
}

function MetaBreakdown({ title, description, rows, loading, collapsed, onToggle }: { title: string; description: string; rows: AudienceSegment[]; loading: boolean; collapsed: boolean; onToggle: () => void }) {
  const totalLeads = rows.reduce((sum, row) => sum + row.leads, 0);
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  return <section className="rounded-lg border border-border/60 p-4"><button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex w-full items-start justify-between gap-3 text-left"><span><h3 className="text-sm font-semibold">{title} <span className="text-xs font-normal text-muted-foreground">· Meta</span></h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></span><ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`} /></button>{!collapsed && (!rows.length ? <p className="py-5 text-xs text-muted-foreground">{loading ? "Carregando dados da Meta…" : "Sem detalhamento sincronizado neste período."}</p> : <><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[430px] text-left text-xs"><thead className="border-b text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="pb-2 font-medium">Segmento</th><th className="pb-2 text-right font-medium">Leads</th><th className="pb-2 text-right font-medium">Participação</th><th className="pb-2 text-right font-medium">Investido</th><th className="pb-2 text-right font-medium">CPL</th><th className="pb-2 text-right font-medium">CTR</th></tr></thead><tbody>{rows.map((row) => { const cpl = row.leads ? row.spend / row.leads : null; const ctr = row.impressions ? row.clicks / row.impressions * 100 : null; return <tr key={row.key} className="border-b border-border/40 last:border-0"><td className="max-w-36 truncate py-2 pr-3 font-medium" title={row.key}>{row.key}</td><td className="py-2 text-right tabular-nums">{row.leads.toLocaleString("pt-BR")}</td><td className="py-2 text-right tabular-nums text-muted-foreground">{totalLeads ? `${(row.leads / totalLeads * 100).toFixed(1)}%` : "—"}</td><td className="py-2 text-right tabular-nums">{row.spend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="py-2 text-right tabular-nums">{cpl === null ? "—" : cpl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td><td className="py-2 text-right tabular-nums">{ctr === null ? "—" : `${ctr.toFixed(2)}%`}</td></tr>; })}</tbody></table></div><p className="mt-3 text-[10px] text-muted-foreground">{totalLeads.toLocaleString("pt-BR")} leads atribuídos · {totalSpend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} investidos.</p></>)}</section>;
}

function downloadAudienceReport(data: AudienceProfileData, startDate: Date, endDate: Date) {
  void downloadAudiencePdf(data, startDate, endDate);
}

async function downloadAudiencePdf(data: AudienceProfileData, startDate: Date, endDate: Date) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = 595; const height = 842; const margin = 36;
  const white = rgb(0.96, 0.97, 0.98); const muted = rgb(0.68, 0.71, 0.75); const accent = rgb(0.38, 0.82, 0.96);
  let page = pdf.addPage([width, height]); let y = height - margin;
  const paint = () => page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.025, 0.027, 0.03) });
  const nextPage = () => { page = pdf.addPage([width, height]); paint(); y = height - margin; };
  const ensure = (needed: number) => { if (y - needed < margin) nextPage(); };
  const draw = (value: string, x: number, size: number, font = regular, color = white) => page.drawText(value, { x, y, size, font, color });
  const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const wrap = (value: string) => value.match(/.{1,42}(?:\s|$)|.{1,42}/g) || [value];
  paint();
  try {
    const response = await fetch("/assets/growdash-logo-transparent.png");
    if (response.ok) { const logo = await pdf.embedPng(await response.arrayBuffer()); const scale = Math.min(118 / logo.width, 34 / logo.height); page.drawImage(logo, { x: margin, y: y - logo.height * scale, width: logo.width * scale, height: logo.height * scale }); }
  } catch { /* logo opcional: o relatório continua sendo gerado. */ }
  y -= 52; draw("Perfil do público e entrega", margin, 20, bold); y -= 20; draw(`Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`, margin, 9, regular, muted); y -= 24;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.18, 0.2, 0.23) }); y -= 24;
  draw("Resumo", margin, 12, bold, accent); y -= 18; draw(`Cadastros RD analisados: ${data.registrations.toLocaleString("pt-BR")}`, margin, 10); y -= 15; draw(`Cadastros com cidade/estado: ${data.locatedRegistrations.toLocaleString("pt-BR")}`, margin, 10); y -= 24;
  const sections: Array<{ title: string; rows: AudienceSegment[]; location?: boolean }> = [
    { title: "Localização dos cadastros · RD", rows: data.locations.map((row) => ({ key: row.key, leads: row.leads, spend: 0, impressions: 0, clicks: 0 })), location: true },
    ...audienceBreakdowns.map((item) => ({ title: `${item.title} · Meta`, rows: data.segments[item.type] })),
  ];
  for (const section of sections) {
    ensure(50); draw(section.title, margin, 12, bold, accent); y -= 17;
    if (!section.rows.length) { draw("Sem detalhamento sincronizado neste período.", margin, 9, regular, muted); y -= 25; continue; }
    draw("Segmento", margin, 8, bold, muted); draw("Leads", 330, 8, bold, muted); draw(section.location ? "Participação" : "Investimento / CPL / CTR", 390, 8, bold, muted); y -= 12;
    const total = section.location ? data.registrations : section.rows.reduce((sum, row) => sum + row.leads, 0);
    for (const row of section.rows) {
      const parts = wrap(row.key); const details = section.location ? `${total ? (row.leads / total * 100).toFixed(1) : "0.0"}%` : `${money(row.spend)} · CPL ${row.leads ? money(row.spend / row.leads) : "—"} · CTR ${row.impressions ? (row.clicks / row.impressions * 100).toFixed(2) : "0.00"}%`;
      ensure(17 * parts.length + 8); parts.forEach((part, index) => { draw(part.trim(), margin, 8.5); if (index < parts.length - 1) y -= 11; });
      const rowY = y; draw(row.leads.toLocaleString("pt-BR"), 330, 8.5); page.drawText(details, { x: 390, y: rowY, size: 7.5, font: regular, color: muted, maxWidth: 168 }); y -= 17;
    }
    y -= 10;
  }
  const bytes = await pdf.save(); const file = new Blob([bytes], { type: "application/pdf" }); const link = document.createElement("a"); link.href = URL.createObjectURL(file); link.download = `perfil-publico-${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.pdf`; link.click(); URL.revokeObjectURL(link.href);
}

export function FunnelAudienceProfile({ deals, campaignIds, accountIds = [], startDate, endDate, data: providedData, loading: providedLoading = false }: { deals: DealLocation[]; campaignIds: string[]; accountIds?: string[]; startDate: Date; endDate: Date; data?: AudienceProfileData; loading?: boolean }) {
  const query = useAudienceProfileData({ deals, campaignIds, accountIds, startDate, endDate });
  const data = providedData || query.data;
  const loading = providedLoading || query.isLoading;
  const errorMessage = query.error instanceof Error ? query.error.message : query.error ? "Não foi possível carregar os detalhamentos da Meta." : null;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const allKeys = ["locations", ...audienceBreakdowns.map((item) => item.type)];
  const allCollapsed = allKeys.every((key) => collapsed[key]);
  const toggleAll = () => setCollapsed(Object.fromEntries(allKeys.map((key) => [key, !allCollapsed])));
  return <Card className="gd-analysis-card border-border/40 bg-card/60"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div><CardTitle className="text-base">Perfil do público e entrega</CardTitle><p className="mt-1 text-xs font-normal text-muted-foreground">Todos os recortes disponíveis da Meta para as campanhas e período selecionados, acompanhados de leads, investimento, CPL e CTR.</p></div><div className="flex shrink-0 gap-2 sm:ml-auto"><Button variant="outline" size="sm" onClick={toggleAll}><Minimize2 className="mr-2 h-4 w-4" />{allCollapsed ? "Expandir todos" : "Recolher todos"}</Button><Button variant="outline" size="sm" onClick={() => downloadAudienceReport(data, startDate, endDate)}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button></div></div></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border border-primary/20 bg-primary/[0.035] px-3 py-2 text-[11px] text-muted-foreground">Os dados da Meta mostram a entrega e as conversões atribuídas por segmento; eles não identificam pessoas individualmente nem provam a idade declarada no RD. Use “Sincronizar Meta + RD” para buscar o período atual.</div>{errorMessage && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">Falha ao carregar detalhamentos da Meta: {errorMessage}</div>}<section className="rounded-lg border border-border/60 p-4"><button type="button" onClick={() => setCollapsed((current) => ({ ...current, locations: !current.locations }))} aria-expanded={!collapsed.locations} className="flex w-full items-start justify-between gap-3 text-left"><span><h3 className="text-sm font-semibold">Localização dos cadastros <span className="text-xs font-normal text-muted-foreground">· RD</span></h3></span><ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed.locations ? "-rotate-90" : ""}`} /></button>{!collapsed.locations && <><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">{data.locations.map((row) => <span key={row.key}><b>{row.key}</b> · {row.leads.toLocaleString("pt-BR")}</span>)}</div><p className="mt-3 text-[10px] text-muted-foreground">{data.registrations.toLocaleString("pt-BR")} cadastros analisados · {data.registrations ? `${(data.locatedRegistrations / data.registrations * 100).toFixed(1)}% com cidade ou estado informado` : "sem cadastros no período"}.</p></>}</section><div className="grid gap-4 xl:grid-cols-2">{audienceBreakdowns.map((item) => <MetaBreakdown key={item.type} {...item} rows={data.segments[item.type]} loading={loading} collapsed={!!collapsed[item.type]} onToggle={() => setCollapsed((current) => ({ ...current, [item.type]: !current[item.type] }))} />)}</div></CardContent></Card>;
}
