import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RDDeal } from "@/hooks/useRDDeals";

type Segment = { key: string; leads: number; spend: number };

function aggregate(rows: any[]): Segment[] {
  const map = new Map<string, Segment>();
  for (const row of rows) {
    const key = String(row.segment_key || "Não informado");
    const current = map.get(key) || { key, leads: 0, spend: 0 };
    current.leads += Number(row.leads || 0);
    current.spend += Number(row.spend || 0);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads || b.spend - a.spend);
}

function List({ rows, empty }: { rows: Segment[]; empty: string }) {
  if (!rows.length) return <p className="py-3 text-xs text-muted-foreground">{empty}</p>;
  const total = rows.reduce((sum, row) => sum + row.leads, 0);
  return <div className="space-y-2">{rows.slice(0, 10).map((row) => (
    <div key={row.key} className="flex items-center gap-3 text-xs">
      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={row.key}>{row.key}</span>
      <span className="tabular-nums font-semibold text-foreground">{row.leads.toLocaleString("pt-BR")}</span>
      <span className="w-12 text-right tabular-nums text-muted-foreground">{total ? `${((row.leads / total) * 100).toFixed(1)}%` : "—"}</span>
    </div>
  ))}</div>;
}

export function FunnelAudienceProfile({ deals, campaignIds, startDate, endDate }: { deals: RDDeal[]; campaignIds: string[]; startDate: Date; endDate: Date }) {
  const breakdownQuery = useQuery({
    queryKey: ["funnel-audience-breakdowns", campaignIds.slice().sort().join(","), format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("insights_breakdowns")
        .select("breakdown_type, segment_key, leads, spend, date")
        .in("campaign_id", campaignIds)
        .in("breakdown_type", ["age", "gender"])
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      const rows = data || [];
      return { age: aggregate(rows.filter((row: any) => row.breakdown_type === "age")), gender: aggregate(rows.filter((row: any) => row.breakdown_type === "gender")) };
    },
    staleTime: 15 * 60 * 1000,
  });

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
  const locationTotal = locations.reduce((sum, row) => sum + row.leads, 0);
  const age = breakdownQuery.data?.age || [];
  const gender = breakdownQuery.data?.gender || [];
  const metaTotal = [...age, ...gender].reduce((sum, row) => sum + row.leads, 0);

  return <Card className="gd-analysis-card bg-card/60 border-border/40">
    <CardHeader><CardTitle className="text-base">Perfil do público</CardTitle><p className="text-xs font-normal text-muted-foreground">Localização dos leads no RD e distribuição demográfica registrada pela Meta no período selecionado.</p></CardHeader>
    <CardContent>
      <div className="grid gap-6 lg:grid-cols-3">
        <section><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Localização · RD</h3><List rows={locations.map((row) => ({ ...row, spend: 0 }))} empty="Nenhuma cidade ou estado informado." /><p className="mt-3 text-[10px] text-muted-foreground">{locationTotal.toLocaleString("pt-BR")} leads analisados · {locations.filter((row) => row.key !== "Não informado").length ? `${((locations.filter((row) => row.key !== "Não informado").reduce((sum, row) => sum + row.leads, 0) / Math.max(1, locationTotal)) * 100).toFixed(1)}% com localização` : "sem localização preenchida"}.</p></section>
        <section><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gênero · Meta</h3><List rows={gender} empty={breakdownQuery.isLoading ? "Carregando dados da Meta…" : "Sem detalhamento de gênero sincronizado."} /><p className="mt-3 text-[10px] text-muted-foreground">Não informado pela Meta não é redistribuído entre os demais grupos.</p></section>
        <section><h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Faixa etária · Meta</h3><List rows={age} empty={breakdownQuery.isLoading ? "Carregando dados da Meta…" : "Sem detalhamento de idade sincronizado."} /><p className="mt-3 text-[10px] text-muted-foreground">Baseado no breakdown de entrega da Meta; não é idade declarada no RD. {metaTotal ? `${metaTotal.toLocaleString("pt-BR")} ocorrências com detalhamento.` : ""}</p></section>
      </div>
    </CardContent>
  </Card>;
}
