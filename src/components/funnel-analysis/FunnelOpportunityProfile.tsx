import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { RDDeal } from "@/hooks/useRDDeals";
import type { InsightRow } from "@/hooks/useInsights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function FunnelOpportunityProfile({ deals, insights = [], campaignIds = [], startDate, endDate }: { deals: RDDeal[]; insights?: InsightRow[]; campaignIds?: string[]; startDate: Date; endDate: Date }) {
  const opportunities = useMemo(() => deals.filter((deal) => deal.stage_bucket === "opportunity"), [deals]);
  const accountIds = useMemo(() => Array.from(new Set(opportunities.map((deal) => deal.ad_account_id).filter(Boolean))), [opportunities]);
  const campaignAccount = useMemo(() => new Map(insights.filter((row) => row.campaign_id && row.ad_account_id).map((row) => [String(row.campaign_id), String(row.ad_account_id)])), [insights]);
  const breakdownQuery = useQuery({
    queryKey: ["funnel-opportunity-profile", campaignIds.slice().sort().join(","), accountIds.slice().sort().join(","), format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd")],
    enabled: campaignIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("insights_breakdowns").select("campaign_id,breakdown_type,segment_key,leads").in("campaign_id", campaignIds).in("breakdown_type", ["age", "gender", "publisher_platform"]).gte("date", format(startDate, "yyyy-MM-dd")).lte("date", format(endDate, "yyyy-MM-dd"));
      if (error) throw error;
      const map = new Map<string, Map<Dimension, Map<string, number>>>();
      for (const row of data || []) {
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
  return <Card className="gd-analysis-card border-border/40 bg-card/60"><CardHeader><CardTitle className="text-base">11. Perfil das oportunidades no RD</CardTitle><p className="mt-1 text-xs text-muted-foreground">Pessoas atualmente na etapa Oportunidade, separadas por conta. RD é a fonte principal; Meta aparece somente como fallback quando não há dimensão individual no RD.</p></CardHeader><CardContent>{!profiles.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade RD no período selecionado.</p> : <div className="space-y-4">{profiles.map((profile) => <section key={profile.accountId} className="rounded-xl border border-border/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><b>Conta {profile.accountId}</b><p className="mt-1 text-xs text-muted-foreground">{profile.opportunities} oportunidade(s) · {total ? (profile.opportunities / total * 100).toFixed(1) : "0.0"}% do total · R$ {profile.pipeline.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em negociação</p></div><span className="text-xs text-muted-foreground">Cobertura dos campos: {profile.totalFields ? (profile.fields / profile.totalFields * 100).toFixed(1) : "0.0"}%</span></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{(["state", "city", "age", "gender", "platform"] as Dimension[]).map((dimension) => <div key={dimension}><b className="text-xs">{dimension === "state" ? "Estado" : dimension === "city" ? "Cidade" : dimension === "age" ? "Idade" : dimension === "gender" ? "Sexo" : "Plataforma"}</b><div className="mt-2 space-y-1">{profile.dimensions[dimension].slice(0, 5).map((row) => <div key={row.key} className="flex justify-between gap-2 text-xs"><span className="truncate" title={row.key}>{row.key}</span><span className="tabular-nums text-muted-foreground">{row.count}</span></div>)}</div></div>)}</div></section>)}</div>}</CardContent></Card>;
}
