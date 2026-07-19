/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Facebook,
  Gauge,
  Link2,
  MousePointerClick,
  RefreshCw,
  Route,
  Target,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useInsights } from "@/hooks/useInsights";
import { useRDDealsForPeriod } from "@/hooks/useRDDealsForPeriod";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { formatMetric, metricDescription, type MetricKind } from "@/lib/metricPresentation";
import { cn } from "@/lib/utils";
import { PageHeading } from "./shared";

type BrandRecord = {
  id: string;
  name: string;
  status: string;
  metadata: Record<string, any>;
};

function useBrandRecord(brandId?: string) {
  const { data: workspace } = useWorkspace();
  const { data: accounts = [], isLoading: accountsLoading } = useAdAccounts();
  const isSynthetic = !!brandId?.startsWith("account-");
  const companyQuery = useQuery({
    queryKey: ["company-diagnostic", workspace?.id, brandId],
    enabled: !!brandId && !isSynthetic && !!workspace?.id && !workspace.id.startsWith("legacy-"),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("companies")
        .select("id, name, status, metadata")
        .eq("workspace_id", workspace!.id)
        .eq("id", brandId)
        .maybeSingle();
      if (error) throw error;
      return data as BrandRecord | null;
    },
  });

  const brand = useMemo<BrandRecord | null>(() => {
    if (isSynthetic) {
      const account = accounts.find((item) => `account-${item.id}` === brandId);
      return account ? {
        id: brandId!,
        name: account.name || `Conta Meta ${account.account_id}`,
        status: "active",
        metadata: { source: "meta_ads", ad_account_id: account.id, meta_account_id: account.account_id },
      } : null;
    }
    return companyQuery.data ?? null;
  }, [accounts, brandId, companyQuery.data, isSynthetic]);

  const account = useMemo(() => {
    if (!brand) return null;
    const internalId = String(brand.metadata?.ad_account_id || "");
    const metaId = String(brand.metadata?.meta_account_id || "");
    return accounts.find((item) => item.id === internalId || String(item.account_id) === metaId) ?? null;
  }, [accounts, brand]);

  return {
    brand,
    account,
    isLoading: accountsLoading || companyQuery.isLoading,
    error: companyQuery.error,
  };
}

function Kpi({ label, value, kind, detail, icon }: { label: string; value: number; kind: MetricKind; detail?: string; icon: ReactNode }) {
  return (
    <MetricHelpTooltip title={label} description={metricDescription(label)} detail={detail} className="h-full" showHint>
      <article className="gd-panel h-full min-w-0 p-4">
        <div className="flex items-start justify-between gap-3 pr-6">
          <div className="min-w-0">
            <span className="block text-[10px] font-black uppercase tracking-[.12em] text-muted-foreground">{label}</span>
            <strong className="mt-2 block truncate text-xl font-black sm:text-2xl" title={formatMetric(value, kind)}>{formatMetric(value, kind)}</strong>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/15 bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        </div>
        {detail && <p className="mt-2 truncate text-[10px] text-muted-foreground" title={detail}>{detail}</p>}
      </article>
    </MetricHelpTooltip>
  );
}

function EmptyAnalytic({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border bg-background/30 p-6 text-center"><div><BarChart3 className="mx-auto h-7 w-7 text-primary" /><b className="mt-3 block text-sm">{title}</b><p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p></div></div>;
}

function HealthItem({ label, value, ok = true, detail }: { label: string; value: string; ok?: boolean; detail?: string }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-background/35 p-4"><span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", ok ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>{ok ? <CheckCircle2 className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}</span><div className="min-w-0"><span className="block text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span><b className="mt-1 block truncate text-sm" title={value}>{value}</b>{detail && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>}</div></div>;
}

export default function BrandDiagnosticPage() {
  const { brandId } = useParams();
  const { brand, account, isLoading, error } = useBrandRecord(brandId);
  const { startDate, endDate, setAdAccountId } = useGlobalFilters();
  const accountId = account?.id;

  useEffect(() => {
    if (accountId) setAdAccountId(accountId);
  }, [accountId, setAdAccountId]);

  const campaignsQuery = useCampaigns(accountId);
  const insightsQuery = useInsights({ adAccountId: accountId, startDate, endDate, enabled: !!accountId });
  const rdQuery = useRDDealsForPeriod({ startDate, endDate, adAccountId: accountId, enabled: !!accountId });
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);
  const insights = useMemo(() => insightsQuery.data ?? [], [insightsQuery.data]);
  const deals = useMemo(() => rdQuery.data ?? [], [rdQuery.data]);

  const totals = useMemo(() => {
    const spend = insights.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const impressions = insights.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    const reach = insights.reduce((sum, row) => sum + Number(row.reach || 0), 0);
    const clicks = insights.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const leads = insights.reduce((sum, row) => sum + Number(row.leads || 0), 0);
    const won = deals.filter((deal) => deal.win);
    const revenue = won.reduce((sum, deal) => sum + Number(deal.amount_total || 0), 0);
    return {
      spend,
      impressions,
      reach,
      clicks,
      leads,
      cpl: leads > 0 ? spend / leads : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
      frequency: reach > 0 ? impressions / reach : 0,
      rdLeads: deals.length,
      won: won.length,
      revenue,
      conversion: deals.length > 0 ? (won.length / deals.length) * 100 : 0,
      roas: spend > 0 ? revenue / spend : 0,
      activeCampaigns: campaigns.filter((item) => ["ACTIVE", "active", "Ativa"].includes(String(item.status))).length,
    };
  }, [campaigns, deals, insights]);

  const campaignPerformance = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; spend: number; impressions: number; clicks: number; leads: number }>();
    for (const row of insights) {
      const id = row.campaign_id || row.campaign_name || "unknown";
      const current = groups.get(id) ?? { id, name: row.campaign_name || "Campanha sem nome", spend: 0, impressions: 0, clicks: 0, leads: 0 };
      current.spend += Number(row.spend || 0);
      current.impressions += Number(row.impressions || 0);
      current.clicks += Number(row.clicks || 0);
      current.leads += Number(row.leads || 0);
      groups.set(id, current);
    }
    return [...groups.values()].sort((a, b) => b.spend - a.spend).slice(0, 8);
  }, [insights]);

  const stages = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const deal of deals) grouped.set(deal.rd_stage_name || "Sem etapa", (grouped.get(deal.rd_stage_name || "Sem etapa") || 0) + 1);
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  }, [deals]);

  if (!brandId) return <Navigate to="/marcas" replace />;
  if (isLoading) return <div className="grid min-h-[50vh] place-items-center"><RefreshCw className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !brand) return <div className="mx-auto max-w-xl py-16 text-center"><TriangleAlert className="mx-auto h-9 w-9 text-amber-500" /><h1 className="mt-4 text-xl font-black">Marca não encontrada</h1><p className="mt-2 text-sm text-muted-foreground">A marca pode ter sido removida ou ainda não foi sincronizada.</p><Link to="/marcas" className="gd-button mt-5"><ArrowLeft className="h-4 w-4" /> Voltar para Marcas</Link></div>;

  const loadingData = insightsQuery.isLoading || campaignsQuery.isLoading || rdQuery.isLoading;
  const syncOk = !account?.last_sync_error && !["error", "expired", "disconnected"].includes(String(account?.connection_status));
  const dateLabel = `${format(startDate, "dd/MM/yyyy")} — ${format(endDate, "dd/MM/yyyy")}`;

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <PageHeading
        eyebrow="Diagnóstico da marca"
        title={brand.name}
        description={`Meta Ads e RD Station reconciliados para ${dateLabel}. Nenhum valor é simulado.`}
        actions={<div className="flex flex-col gap-2 sm:flex-row"><Link to="/marcas" className="gd-button"><ArrowLeft className="h-4 w-4" /> Marcas</Link><Link to={`/campanhas?aba=campaigns&conta=${accountId || "all"}`} className="gold-action"><Facebook className="h-4 w-4" /> Abrir campanhas</Link></div>}
      />

      {!account ? <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-300"><TriangleAlert className="mr-2 inline h-4 w-4" />A marca existe, mas não está vinculada a uma conta Meta Ads válida. Revise o vínculo em Integrações.</div> : null}

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/70 p-3">
        <Badge variant="outline" className="border-primary/25 text-primary">ID Meta: {brand.metadata?.meta_account_id || account?.account_id || "não vinculado"}</Badge>
        <Badge variant="outline">Período: {dateLabel}</Badge>
        <Badge variant="outline" className={syncOk ? "border-emerald-500/25 text-emerald-500" : "border-amber-500/25 text-amber-500"}>{syncOk ? "Conexão saudável" : "Conexão requer atenção"}</Badge>
        {loadingData && <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Atualizando dados…</span>}
      </div>

      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="media">Mídia paga</TabsTrigger>
          <TabsTrigger value="funnel">Funil RD</TabsTrigger>
          <TabsTrigger value="health">Saúde e sincronização</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Investimento Meta" value={totals.spend} kind="currency" icon={<CircleDollarSign />} detail={`${totals.activeCampaigns} campanha(s) ativa(s)`} />
            <Kpi label="Leads Meta" value={totals.leads} kind="count" icon={<UsersRound />} detail={`CPL ${formatMetric(totals.cpl, "currency")}`} />
            <Kpi label="Leads no RD" value={totals.rdLeads} kind="count" icon={<Route />} detail={`${totals.won} venda(s) ganha(s)`} />
            <Kpi label="ROAS" value={totals.roas} kind="ratio" icon={<Gauge />} detail={`Receita ${formatMetric(totals.revenue, "currency")}`} />
            <Kpi label="Impressões" value={totals.impressions} kind="count" icon={<Eye />} />
            <Kpi label="Cliques no link" value={totals.clicks} kind="count" icon={<MousePointerClick />} detail={`CTR ${formatMetric(totals.ctr, "percentage")}`} />
            <Kpi label="Taxa de conversão" value={totals.conversion} kind="percentage" icon={<Target />} detail="RD → vendas ganhas" />
            <Kpi label="Receita gerada" value={totals.revenue} kind="currency" icon={<BadgeDollarSign />} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <section className="gd-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-black">Campanhas com maior investimento</h2><p className="mt-1 text-xs text-muted-foreground">Desempenho agregado no período selecionado.</p></div>{campaignPerformance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/35 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3 text-left">Campanha</th><th className="p-3 text-right">Investimento</th><th className="p-3 text-right">Impressões</th><th className="p-3 text-right">Cliques</th><th className="p-3 text-right">Leads</th><th className="p-3 text-right">CPL</th></tr></thead><tbody className="divide-y divide-border">{campaignPerformance.map((item) => <tr key={item.id}><td className="max-w-80 truncate p-3 font-semibold" title={item.name}>{item.name}</td><td className="p-3 text-right">{formatMetric(item.spend, "currency")}</td><td className="p-3 text-right">{formatMetric(item.impressions, "count")}</td><td className="p-3 text-right">{formatMetric(item.clicks, "count")}</td><td className="p-3 text-right">{formatMetric(item.leads, "count")}</td><td className="p-3 text-right">{formatMetric(item.leads ? item.spend / item.leads : 0, "currency")}</td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyAnalytic title="Sem campanhas com métricas" description="Os widgets permanecem visíveis e serão preenchidos após a primeira sincronização do período." /></div>}</section>
            <section className="gd-panel p-5"><h2 className="font-black">Reconciliação Meta × RD</h2><p className="mt-1 text-xs text-muted-foreground">Compara atribuição de mídia e entradas reais no CRM.</p><div className="mt-6 space-y-5"><div><div className="mb-2 flex justify-between text-xs"><span>Leads Meta</span><b>{formatMetric(totals.leads, "count")}</b></div><Progress value={totals.leads || totals.rdLeads ? (totals.leads / Math.max(totals.leads, totals.rdLeads)) * 100 : 0} /></div><div><div className="mb-2 flex justify-between text-xs"><span>Leads RD</span><b>{formatMetric(totals.rdLeads, "count")}</b></div><Progress value={totals.leads || totals.rdLeads ? (totals.rdLeads / Math.max(totals.leads, totals.rdLeads)) * 100 : 0} /></div><div className="rounded-xl border border-border bg-background/40 p-4"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">Diferença RD − Meta</span><strong className={cn("mt-2 block text-2xl", totals.rdLeads - totals.leads >= 0 ? "text-emerald-500" : "text-amber-500")}>{totals.rdLeads - totals.leads > 0 ? "+" : ""}{formatMetric(totals.rdLeads - totals.leads, "count")}</strong><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">A diferença pode refletir janela de atribuição, UTMs, duplicidade ou entradas orgânicas no RD.</p></div></div></section>
          </div>
        </TabsContent>

        <TabsContent value="media" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Investimento" value={totals.spend} kind="currency" icon={<CircleDollarSign />} /><Kpi label="Alcance" value={totals.reach} kind="count" icon={<UsersRound />} /><Kpi label="CPM" value={totals.cpm} kind="currency" icon={<Eye />} /><Kpi label="Frequência" value={totals.frequency} kind="decimal" icon={<Activity />} /></div>
          <section className="gd-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-black">Performance de campanhas</h2><p className="mt-1 text-xs text-muted-foreground">Mesmo sem resultados, todas as colunas permanecem disponíveis para diagnóstico.</p></div>{campaignPerformance.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/35 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3 text-left">Campanha</th><th className="p-3 text-right">Investimento</th><th className="p-3 text-right">Impressões</th><th className="p-3 text-right">Cliques</th><th className="p-3 text-right">CTR</th><th className="p-3 text-right">Leads</th><th className="p-3 text-right">CPL</th></tr></thead><tbody className="divide-y divide-border">{campaignPerformance.map((item) => <tr key={item.id}><td className="max-w-96 truncate p-3 font-semibold">{item.name}</td><td className="p-3 text-right">{formatMetric(item.spend, "currency")}</td><td className="p-3 text-right">{formatMetric(item.impressions, "count")}</td><td className="p-3 text-right">{formatMetric(item.clicks, "count")}</td><td className="p-3 text-right">{formatMetric(item.impressions ? (item.clicks / item.impressions) * 100 : 0, "percentage")}</td><td className="p-3 text-right">{formatMetric(item.leads, "count")}</td><td className="p-3 text-right">{formatMetric(item.leads ? item.spend / item.leads : 0, "currency")}</td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyAnalytic title="Aguardando métricas da Meta" description="Confirme a conexão, o período e a última sincronização desta conta." /></div>}</section>
        </TabsContent>

        <TabsContent value="funnel" className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Leads totais" value={totals.rdLeads} kind="count" icon={<UsersRound />} /><Kpi label="Conversões / Vendas" value={totals.won} kind="count" icon={<CheckCircle2 />} /><Kpi label="Taxa de conversão" value={totals.conversion} kind="percentage" icon={<Target />} /><Kpi label="Ticket médio" value={totals.won ? totals.revenue / totals.won : 0} kind="currency" icon={<BadgeDollarSign />} /></div>
          <section className="gd-panel p-5"><h2 className="font-black">Distribuição por etapa do RD</h2><p className="mt-1 text-xs text-muted-foreground">Quantidade de negócios em cada etapa no período selecionado.</p>{stages.length ? <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{stages.map(([stage, count]) => <div key={stage} className="rounded-xl border border-border bg-background/35 p-4"><div className="flex items-center justify-between gap-3"><b className="truncate text-sm" title={stage}>{stage}</b><strong>{formatMetric(count, "count")}</strong></div><Progress className="mt-3" value={totals.rdLeads ? (count / totals.rdLeads) * 100 : 0} /><span className="mt-2 block text-[10px] text-muted-foreground">{formatMetric(totals.rdLeads ? (count / totals.rdLeads) * 100 : 0, "percentage")} do funil</span></div>)}</div> : <div className="mt-5"><EmptyAnalytic title="Sem negociações no RD" description="O funil aparecerá assim que a conta estiver vinculada e os negócios forem sincronizados." /></div>}</section>
        </TabsContent>

        <TabsContent value="health" className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><HealthItem label="Conexão Meta" value={account?.connection_status || "não vinculada"} ok={syncOk} detail={account?.last_sync_error || "Sem erro de conexão registrado."} /><HealthItem label="Saúde OAuth" value={account?.oauth_health_status || "não verificada"} ok={!account?.oauth_health_status || ["healthy", "ok", "unchecked"].includes(account.oauth_health_status)} detail="Monitora token e permissões removidas." /><HealthItem label="Último sucesso" value={account?.last_sync_success_at ? new Date(account.last_sync_success_at).toLocaleString("pt-BR") : "nunca sincronizada"} ok={!!account?.last_sync_success_at} /><HealthItem label="Fuso horário" value={account?.timezone_name || "America/Sao_Paulo"} detail="Datas devem respeitar o fuso da conta de anúncio." /><HealthItem label="Atribuição" value={account?.attribution_window || "padrão da conta"} detail="Deve corresponder à janela configurada no Meta Ads." /><HealthItem label="Dados do período" value={`${formatMetric(insights.length, "count")} linha(s) Meta · ${formatMetric(deals.length, "count")} negócio(s) RD`} ok={!insightsQuery.error && !rdQuery.error} detail={insightsQuery.error || rdQuery.error ? "Uma das fontes retornou erro. Consulte Saúde dos Dados." : "Fontes consultadas sem erro de leitura."} /></div>
          <div className="flex flex-wrap gap-2"><Link to="/saude-dos-dados" className="gold-action"><Activity className="h-4 w-4" /> Diagnóstico completo</Link><Link to="/integracoes" className="gd-button"><Link2 className="h-4 w-4" /> Revisar integrações</Link></div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
