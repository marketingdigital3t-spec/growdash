import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RDDeal } from "@/hooks/useRDDeals";
import type { InsightRow } from "@/hooks/useInsights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filterMetaBreakdownsByAttribution } from "@/lib/metaBreakdownScope";
import { businessDateKey } from "@/lib/businessDate";

type Dimension = "state" | "city" | "age" | "gender" | "platform";
type ProfileRow = { key: string; count: number };
type AccountProfile = { accountId: string; opportunities: number; pipeline: number; fields: number; totalFields: number; dimensions: Record<Dimension, ProfileRow[]> };

const aliases: Record<Exclude<Dimension, "state" | "city">, string[]> = {
  age: ["idade", "age", "faixa_etaria", "faixa etaria"],
  gender: ["sexo", "genero", "gênero", "gender"],
  platform: ["plataforma", "platform", "origem plataforma"],
};
const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const fieldValue = (deal: RDDeal, names: string[]) => {
  const fields = deal.custom_fields && typeof deal.custom_fields === "object" ? deal.custom_fields : {};
  const wanted = names.map(normalize).map((value) => value.replace(/[^a-z0-9]/g, ""));
  for (const [key, value] of Object.entries(fields)) if (wanted.includes(normalize(key).replace(/[^a-z0-9]/g, "")) && String(value ?? "").trim()) return String(value).trim();
  return null;
};
const add = (map: Map<string, number>, key: string | null) => { const safe = key?.trim() || "Não informado"; map.set(safe, (map.get(safe) || 0) + 1); };
const rows = (map: Map<string, number>): ProfileRow[] => Array.from(map.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "pt-BR"));

export function FunnelOpportunityProfile({ deals, insights = [], campaignIds = [], startDate, endDate, attributionWindowByCampaign = {} }: { deals: RDDeal[]; insights?: InsightRow[]; campaignIds?: string[]; startDate: Date; endDate: Date; attributionWindowByCampaign?: Record<string, string> }) {
  const opportunities = useMemo(() => deals.filter((deal) => deal.stage_bucket === "opportunity"), [deals]);
  const accountIds = useMemo(() => Array.from(new Set(opportunities.map((deal) => deal.ad_account_id).filter(Boolean))), [opportunities]);
  const campaignAccount = useMemo(() => new Map(insights.filter((row) => row.campaign_id && row.ad_account_id).map((row) => [String(row.campaign_id), String(row.ad_account_id)])), [insights]);
  const opportunityKey = useMemo(() => opportunities.map((deal) => `${deal.rd_deal_id}:${deal.updated_at || deal.stage_updated_at || ""}`).sort().join(","), [opportunities]);
  const breakdownQuery = useQuery({
    queryKey: ["funnel-opportunity-profile", campaignIds.slice().sort().join(","), accountIds.slice().sort().join(","), opportunityKey, businessDateKey(startDate), businessDateKey(endDate), JSON.stringify(Object.entries(attributionWindowByCampaign).sort(([a], [b]) => a.localeCompare(b)))],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const data: Array<{ campaign_id: string; breakdown_type: string; segment_key: string | null; leads: number | null }> = [];
      const PAGE = 1000;
      for (let page = 0; ; page += 1) {
        const { data: batch, error } = await (supabase as any).from("insights_breakdowns").select("campaign_id,attribution_window,breakdown_type,segment_key,leads").in("campaign_id", campaignIds).in("breakdown_type", ["age", "gender", "publisher_platform"]).gte("date", businessDateKey(startDate)).lte("date", businessDateKey(endDate)).range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        data.push(...((batch || []) as typeof data));
        if (!batch || batch.length < PAGE) break;
      }
      const map = new Map<string, Map<Dimension, Map<string, number>>>();
      for (const row of filterMetaBreakdownsByAttribution(data, attributionWindowByCampaign)) {
        const accountId = campaignAccount.get(String(row.campaign_id));
        if (!accountId) continue;
        const dimension: Dimension = row.breakdown_type === "publisher_platform" ? "platform" : row.breakdown_type;
        const account = map.get(accountId) || new Map<Dimension, Map<string, number>>();
        const values = account.get(dimension) || new Map<string, number>();
        values.set(String(row.segment_key || "Não informado"), (values.get(String(row.segment_key || "Não informado")) || 0) + Number(row.leads || 0));
        account.set(dimension, values); map.set(accountId, account);
      }
      return map;
    },
    staleTime: 15 * 60 * 1000,
  });
  const profiles = useMemo<AccountProfile[]>(() => accountIds.map((accountId) => {
    const accountDeals = opportunities.filter((deal) => deal.ad_account_id === accountId);
    const maps: Record<Dimension, Map<string, number>> = { state: new Map(), city: new Map(), age: new Map(), gender: new Map(), platform: new Map() };
    let fields = 0;
    for (const deal of accountDeals) {
      const values: Record<Dimension, string | null> = { state: deal.lead_state, city: deal.lead_city, age: fieldValue(deal, aliases.age), gender: fieldValue(deal, aliases.gender), platform: fieldValue(deal, aliases.platform) };
      for (const dimension of Object.keys(values) as Dimension[]) { if (values[dimension]) fields += 1; add(maps[dimension], values[dimension]); }
    }
    const fallback = breakdownQuery.data?.get(accountId);
    for (const dimension of ["age", "gender", "platform"] as const) if (maps[dimension].size === 1 && maps[dimension].has("Não informado") && fallback?.get(dimension)) maps[dimension] = fallback.get(dimension)!;
    return { accountId, opportunities: accountDeals.length, pipeline: accountDeals.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0), fields, totalFields: accountDeals.length * 5, dimensions: { state: rows(maps.state), city: rows(maps.city), age: rows(maps.age), gender: rows(maps.gender), platform: rows(maps.platform) } };
  }), [accountIds, breakdownQuery.data, opportunities]);
  const total = opportunities.length;
  return <Card className="gd-analysis-card border-border/40 bg-card/60"><CardHeader className="pb-3"><CardTitle className="text-base">11. Perfil das oportunidades no RD</CardTitle><p className="mt-1 text-xs text-muted-foreground">Leitura rápida das oportunidades por conta, com cobertura dos campos e principais perfis.</p></CardHeader><CardContent className="pt-1">{!profiles.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade RD no período selecionado.</p> : <div className="space-y-3">{profiles.map((profile) => <section key={profile.accountId} className="rounded-xl border border-border/50 bg-muted/[0.08] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm" title={profile.accountId}>Conta {profile.accountId}</b><p className="mt-1 text-xs text-muted-foreground">{profile.opportunities} oportunidade(s) · {total ? (profile.opportunities / total * 100).toFixed(1) : "0.0"}% do total · R$ {profile.pipeline.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em negociação</p></div><div className="w-full shrink-0 sm:w-44"><div className="flex justify-between text-[10px] text-muted-foreground"><span>Cobertura dos campos</span><b className="text-foreground">{profile.totalFields ? (profile.fields / profile.totalFields * 100).toFixed(1) : "0.0"}%</b></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${profile.totalFields ? profile.fields / profile.totalFields * 100 : 0}%` }} /></div></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(["state", "city", "age", "gender", "platform"] as Dimension[]).map((dimension) => <div key={dimension} className="min-w-0 rounded-lg border border-border/50 bg-background/35 p-2.5"><b className="text-[10px] uppercase tracking-wide text-muted-foreground">{dimension === "state" ? "Estado" : dimension === "city" ? "Cidade" : dimension === "age" ? "Idade" : dimension === "gender" ? "Sexo" : "Plataforma"}</b><div className="mt-2 space-y-1.5">{profile.dimensions[dimension].slice(0, 4).map((row) => <div key={row.key} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate" title={row.key}>{row.key}</span><span className="shrink-0 tabular-nums text-muted-foreground">{row.count}</span></div>)}</div></div>)}</div></section>)}</div>}</CardContent></Card>;
}
