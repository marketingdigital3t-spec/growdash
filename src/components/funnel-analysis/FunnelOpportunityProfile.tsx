import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RDDeal } from "@/hooks/useRDDeals";
import { isWonRDStageName } from "@/lib/rdDealStatus";
import type { InsightRow } from "@/hooks/useInsights";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filterMetaBreakdownsByAttribution } from "@/lib/metaBreakdownScope";
import { businessDateKey } from "@/lib/businessDate";

type Dimension = "state" | "city" | "age" | "gender" | "platform";
type MetaDimension = "age" | "gender" | "platform";
export type ProfileRow = { key: string; count: number };
type IndividualProfile = { total: number; fields: number; totalFields: number; dimensions: Record<Dimension, ProfileRow[]> };
type MetaProfile = Record<MetaDimension, ProfileRow[]>;
type AccountProfile = { accountId: string; opportunities: IndividualProfile; buyers: IndividualProfile; pipeline: number; meta: MetaProfile | null; metaLinkedDeals: number };

const aliases: Record<Exclude<Dimension, "state" | "city">, string[]> = {
  age: ["idade", "age", "faixa_etaria", "faixa etaria"],
  gender: ["sexo", "genero", "gênero", "gender"],
  platform: ["plataforma", "platform", "origem plataforma"],
};

const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function rdProfileField(deal: RDDeal, names: string[]) {
  const fields = deal.custom_fields && typeof deal.custom_fields === "object" ? deal.custom_fields : {};
  const wanted = names.map(normalize).map((value) => value.replace(/[^a-z0-9]/g, ""));
  for (const [key, value] of Object.entries(fields)) {
    const normalizedKey = normalize(key).replace(/[^a-z0-9]/g, "");
    if ((wanted.includes(normalizedKey) || wanted.some((alias) => normalizedKey.endsWith(alias))) && String(value ?? "").trim()) return String(value).trim();
  }
  return null;
}

function add(map: Map<string, number>, key: string | null) {
  const safe = key?.trim() || "Não informado";
  map.set(safe, (map.get(safe) || 0) + 1);
}

export function profileRows(map: Map<string, number>): ProfileRow[] {
  return Array.from(map.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "pt-BR"));
}

function individualProfile(deals: RDDeal[]): IndividualProfile {
  const dimensions: Record<Dimension, Map<string, number>> = { state: new Map(), city: new Map(), age: new Map(), gender: new Map(), platform: new Map() };
  let fields = 0;
  for (const deal of deals) {
    const values: Record<Dimension, string | null> = { state: deal.lead_state, city: deal.lead_city, age: rdProfileField(deal, aliases.age), gender: rdProfileField(deal, aliases.gender), platform: rdProfileField(deal, aliases.platform) };
    for (const dimension of Object.keys(values) as Dimension[]) { if (values[dimension]) fields += 1; add(dimensions[dimension], values[dimension]); }
  }
  return { total: deals.length, fields, totalFields: deals.length * 5, dimensions: { state: profileRows(dimensions.state), city: profileRows(dimensions.city), age: profileRows(dimensions.age), gender: profileRows(dimensions.gender), platform: profileRows(dimensions.platform) } };
}

function formatCurrency(value: number) { return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const dimensionLabels: Record<Dimension, string> = { state: "Estado", city: "Cidade", age: "Idade", gender: "Sexo", platform: "Plataforma" };

function DimensionGrid({ profile }: { profile: IndividualProfile }) {
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(dimensionLabels) as Dimension[]).map((dimension) => <div key={dimension} className="min-w-0 rounded-lg border border-border/50 bg-background/35 p-2.5"><b className="text-[10px] uppercase tracking-wide text-muted-foreground">{dimensionLabels[dimension]}</b><div className="mt-2 space-y-1.5">{profile.dimensions[dimension].slice(0, 4).map((row) => <div key={row.key} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate" title={row.key}>{row.key}</span><span className="shrink-0 tabular-nums text-muted-foreground">{row.count}</span></div>)}</div></div>)}</div>;
}

function MetaGrid({ meta }: { meta: MetaProfile }) {
  const labels: Record<MetaDimension, string> = { age: "Faixa etária", gender: "Gênero", platform: "Plataforma" };
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(Object.keys(labels) as MetaDimension[]).map((dimension) => <div key={dimension} className="min-w-0 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5"><b className="text-[10px] uppercase tracking-wide text-muted-foreground">{labels[dimension]}</b><div className="mt-2 space-y-1.5">{meta[dimension].slice(0, 5).map((row) => <div key={row.key} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate" title={row.key}>{row.key}</span><span className="shrink-0 tabular-nums text-muted-foreground">{row.count}</span></div>)}</div></div>)}</div>;
}

export function FunnelOpportunityProfile({ deals, insights = [], campaignIds = [], startDate, endDate, attributionWindowByCampaign = {} }: { deals: RDDeal[]; insights?: InsightRow[]; campaignIds?: string[]; startDate: Date; endDate: Date; attributionWindowByCampaign?: Record<string, string> }) {
  const opportunityDeals = useMemo(() => deals.filter((deal) => deal.stage_bucket === "opportunity" && !deal.win && !isWonRDStageName(deal.rd_stage_name)), [deals]);
  const buyerDeals = useMemo(() => deals.filter((deal) => deal.stage_bucket === "client" || deal.win || isWonRDStageName(deal.rd_stage_name)), [deals]);
  const scopedDeals = useMemo(() => [...opportunityDeals, ...buyerDeals].filter((deal, index, all) => all.findIndex((item) => item.rd_deal_id === deal.rd_deal_id) === index), [opportunityDeals, buyerDeals]);
  const accountIds = useMemo(() => Array.from(new Set(scopedDeals.map((deal) => deal.ad_account_id).filter(Boolean) as string[])), [scopedDeals]);
  const campaignAccount = useMemo(() => new Map(insights.filter((row) => row.campaign_id && row.ad_account_id).map((row) => [String(row.campaign_id), String(row.ad_account_id)])), [insights]);
  const selectedCampaigns = useMemo(() => new Set(campaignIds.map(String)), [campaignIds]);
  const opportunityKey = useMemo(() => scopedDeals.map((deal) => `${deal.rd_deal_id}:${deal.updated_at || deal.stage_updated_at || ""}`).sort().join(","), [scopedDeals]);
  const breakdownQuery = useQuery({
    queryKey: ["funnel-opportunity-profile-v2", campaignIds.slice().sort().join(","), accountIds.slice().sort().join(","), opportunityKey, businessDateKey(startDate), businessDateKey(endDate), JSON.stringify(Object.entries(attributionWindowByCampaign).sort(([a], [b]) => a.localeCompare(b)))],
    enabled: campaignIds.length > 0 && scopedDeals.length > 0,
    queryFn: async () => {
      const data: Array<{ campaign_id: string; attribution_window?: string | null; breakdown_type: string; segment_key: string | null; leads: number | null }> = [];
      const PAGE = 1000;
      for (let page = 0; ; page += 1) {
        const { data: batch, error } = await (supabase as any).from("insights_breakdowns").select("campaign_id,attribution_window,breakdown_type,segment_key,leads").in("campaign_id", campaignIds).in("breakdown_type", ["age", "gender", "publisher_platform"]).gte("date", businessDateKey(startDate)).lte("date", businessDateKey(endDate)).order("date", { ascending: true }).range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        data.push(...((batch || []) as typeof data));
        if (!batch || batch.length < PAGE) break;
      }
      const map = new Map<string, Record<MetaDimension, Map<string, number>>>();
      for (const row of filterMetaBreakdownsByAttribution(data, attributionWindowByCampaign)) {
        const accountId = campaignAccount.get(String(row.campaign_id));
        if (!accountId) continue;
        const dimension: MetaDimension = row.breakdown_type === "publisher_platform" ? "platform" : row.breakdown_type as "age" | "gender";
        const account = map.get(accountId) || { age: new Map(), gender: new Map(), platform: new Map() };
        const key = String(row.segment_key || "Não informado");
        account[dimension].set(key, (account[dimension].get(key) || 0) + Number(row.leads || 0));
        map.set(accountId, account);
      }
      return map;
    },
    staleTime: 15 * 60 * 1000,
  });

  const profiles = useMemo<AccountProfile[]>(() => accountIds.map((accountId) => {
    const accountOpportunities = opportunityDeals.filter((deal) => deal.ad_account_id === accountId);
    const accountBuyers = buyerDeals.filter((deal) => deal.ad_account_id === accountId);
    const accountDeals = [...accountOpportunities, ...accountBuyers].filter((deal, index, all) => all.findIndex((item) => item.rd_deal_id === deal.rd_deal_id) === index);
    const linkedDeals = accountDeals.filter((deal) => {
      const explicitCampaign = deal.meta_campaign_id && selectedCampaigns.has(String(deal.meta_campaign_id)) && campaignAccount.get(String(deal.meta_campaign_id)) === accountId;
      const explicitLead = Boolean(deal.meta_lead_id);
      const accountCampaign = [...selectedCampaigns].some((campaignId) => campaignAccount.get(campaignId) === accountId);
      return Boolean(explicitCampaign || (explicitLead && accountCampaign));
    });
    const metaMaps = breakdownQuery.data?.get(accountId);
    const meta = metaMaps && linkedDeals.length > 0 ? { age: profileRows(metaMaps.age), gender: profileRows(metaMaps.gender), platform: profileRows(metaMaps.platform) } : null;
    return { accountId, opportunities: individualProfile(accountOpportunities), buyers: individualProfile(accountBuyers), pipeline: accountDeals.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0), meta, metaLinkedDeals: linkedDeals.length };
  }), [accountIds, opportunityDeals, buyerDeals, campaignAccount, selectedCampaigns, breakdownQuery.data]);

  const total = scopedDeals.length;
  const status = breakdownQuery.isLoading ? "Carregando estimativas agregadas da Meta…" : breakdownQuery.isError ? "Estimativas Meta indisponíveis; o perfil individual do RD continua sendo exibido." : "Dados individuais vêm do RD Station. As estimativas Meta aparecem separadas e não representam atributos individuais.";

  return <Card className="gd-analysis-card border-border/40 bg-card/60"><CardHeader className="pb-3"><CardTitle className="text-base">11. Perfil de oportunidades e compradores no RD</CardTitle><p className="mt-1 text-xs text-muted-foreground">Perfil real dos negócios que chegaram a oportunidade e dos que foram ganhos no RD Station.</p><p className="mt-2 text-[11px] text-muted-foreground">{status}</p></CardHeader><CardContent className="pt-1">{!profiles.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma oportunidade ou venda ganha no período selecionado.</p> : <div className="space-y-3">{profiles.map((profile) => <section key={profile.accountId} className="rounded-xl border border-border/50 bg-muted/[0.08] p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm" title={profile.accountId}>Conta {profile.accountId}</b><p className="mt-1 text-xs text-muted-foreground">{profile.opportunities.total} oportunidade(s) · {profile.buyers.total} comprador(es) · {total ? ((profile.opportunities.total + profile.buyers.total) / total * 100).toFixed(1) : "0.0"}% do recorte · {formatCurrency(profile.pipeline)}</p></div><div className="w-full shrink-0 sm:w-44"><div className="flex justify-between text-[10px] text-muted-foreground"><span>Cobertura dos campos RD</span><b className="text-foreground">{profile.opportunities.total + profile.buyers.total ? (((profile.opportunities.fields + profile.buyers.fields) / (profile.opportunities.totalFields + profile.buyers.totalFields)) * 100).toFixed(1) : "0.0"}%</b></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${profile.opportunities.total + profile.buyers.total ? ((profile.opportunities.fields + profile.buyers.fields) / (profile.opportunities.totalFields + profile.buyers.totalFields)) * 100 : 0}%` }} /></div></div></div><div className="mt-3 space-y-3">{profile.opportunities.total > 0 && <div><div className="mb-2 flex items-center justify-between"><b className="text-xs">Perfil individual — oportunidades</b><span className="text-[11px] text-muted-foreground">{profile.opportunities.total} negócios · {profile.opportunities.totalFields - profile.opportunities.fields} campos não informados</span></div><DimensionGrid profile={profile.opportunities} /></div>}{profile.buyers.total > 0 && <div><div className="mb-2 flex items-center justify-between"><b className="text-xs">Perfil individual — compradores/vendas</b><span className="text-[11px] text-muted-foreground">{profile.buyers.total} negócios · {profile.buyers.totalFields - profile.buyers.fields} campos não informados</span></div><DimensionGrid profile={profile.buyers} /></div>}<div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3"><b className="text-xs">Estimativas de público associadas às oportunidades e vendas</b><p className="mt-1 text-[11px] text-muted-foreground">Estimativa agregada da Meta — não representa a idade individual de cada lead.</p>{!profile.meta ? <p className="mt-2 text-xs text-muted-foreground">Não foi possível associar uma estimativa Meta a estes negócios.</p> : <><p className="mt-2 text-[11px] text-muted-foreground">Base da associação: {profile.metaLinkedDeals} negócio(s) com vínculo de lead/campanha.</p><div className="mt-2"><MetaGrid meta={profile.meta} /></div></>}</div></div></section>)}</div>}</CardContent></Card>;
}
