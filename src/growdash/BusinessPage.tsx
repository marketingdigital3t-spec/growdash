import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Instagram, RefreshCw, ShieldAlert, Users, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useInsights } from "@/hooks/useInsights";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { withRequestTimeout } from "@/lib/resilience";
import { Button } from "@/components/ui/button";
import { PageHeading } from "./shared";

type SocialAccount = {
  id: string;
  provider: string;
  display_name: string;
  username: string | null;
  followers_count: number;
  connection_status: string;
  last_sync_at: string | null;
  last_error: string | null;
};

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function StateCard({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <section className="gd-panel grid min-h-32 place-items-center p-5 text-center"><div><p className="font-bold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p>{action && <div className="mt-3">{action}</div>}</div></section>;
}

function Kpi({ label, value, source = "Meta Ads · período selecionado" }: { label: string; value: string; source?: string }) {
  return <article className="gd-panel p-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-black tabular-nums">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{source}</p></article>;
}

export default function BusinessPage() {
  const { user } = useAuth();
  const { adAccountId, adAccountIds, startDate, endDate, workspaceId } = useGlobalFilters();
  const accountsQuery = useAdAccounts(false);
  const accounts = accountsQuery.data ?? [];
  const selectedAccount = accounts.find((account) => account.id === adAccountId);
  const selectedId = adAccountId !== "all" ? adAccountId : "";
  const insightsQuery = useInsights({
    adAccountId: selectedId || undefined,
    adAccountIds: selectedId ? undefined : adAccountIds,
    startDate,
    endDate,
    enabled: !!selectedId || adAccountIds.length > 0,
  });
  const socialQuery = useQuery({
    queryKey: ["business_social_accounts", user?.id, workspaceId, selectedId, startDate.toISOString(), endDate.toISOString()],
    enabled: !!user && !!workspaceId,
    queryFn: async () => {
      const query = supabase.from("social_accounts").select("id,provider,display_name,username,followers_count,connection_status,last_sync_at,last_error").eq("workspace_id", workspaceId);
      const { data, error } = await withRequestTimeout(query, 12_000);
      if (error) throw error;
      return (data ?? []) as SocialAccount[];
    },
    staleTime: 15 * 60_000,
  });

  const totals = useMemo(() => (insightsQuery.data ?? []).reduce((sum, row) => ({
    spend: sum.spend + Number(row.spend || 0),
    impressions: sum.impressions + Number(row.impressions || 0),
    reach: sum.reach + Number(row.reach || 0),
    clicks: sum.clicks + Number(row.clicks || 0),
    leads: sum.leads + Number(row.leads || 0),
    actions: sum.actions + Number(row.leads || 0),
  }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, actions: 0 }), [insightsQuery.data]);
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions * 100 : null;
  const cpm = totals.impressions > 0 ? totals.spend / totals.impressions * 1000 : null;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
  const frequency = totals.reach > 0 ? totals.impressions / totals.reach : null;
  const socialAccounts = socialQuery.data ?? [];
  const socialError = socialQuery.error as Error | null;

  if (accountsQuery.isLoading) return <StateCard title="Carregando contas Meta…" description="A Growdash está consultando somente contas autorizadas." />;
  if (accountsQuery.isError) return <StateCard title="Não foi possível carregar as contas Meta" description={(accountsQuery.error as Error).message} action={<Button variant="outline" onClick={() => void accountsQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>} />;
  if (!accounts.length) return <StateCard title="Nenhuma conta Meta autorizada" description="Conecte uma conta em Integrações para carregar dados oficiais." />;
  if (adAccountId !== "all" && !accounts.some((account) => account.id === adAccountId)) return <StateCard title="Conta Meta bloqueada ou sem permissão" description="A conta selecionada não está autorizada para este workspace. Nenhum dado de outra conta foi usado." />;
  if (adAccountId === "all" && adAccountIds.length === 0) return <StateCard title="Selecione uma conta Meta" description="O Business trabalha com uma conta por vez. Escolha uma conta nos filtros globais para carregar dados oficiais." />;
  if (adAccountIds.length > 1) return <StateCard title="Selecione apenas uma conta Meta" description="O espelho do Business Suite não consolida contas diferentes nesta visão. Remova as contas extras do filtro global e tente novamente." />;
  if (insightsQuery.isError) return <StateCard title="Insights indisponíveis pela Meta" description={(insightsQuery.error as Error).message} action={<Button variant="outline" onClick={() => void insightsQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button>} />;

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <PageHeading eyebrow="Meta Business Suite" title="Business" description="Dados oficiais de anúncios e ativos sociais, separados por conta, ativo e período." actions={<div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-emerald-500" />Conta: {selectedAccount?.name ?? `${adAccountIds.length} selecionada(s)`}</div>} />
    <section className="rounded-2xl border border-primary/20 bg-primary/[.06] p-4 text-xs leading-5 text-muted-foreground"><b className="text-foreground">Escopo confirmado:</b> {format(startDate, "dd/MM/yyyy", { locale: ptBR })}–{format(endDate, "dd/MM/yyyy", { locale: ptBR })} · America/Sao_Paulo · somente contas autorizadas. Métricas ausentes não são estimadas.</section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Investimento" value={currency.format(totals.spend)} /><Kpi label="Impressões" value={number.format(totals.impressions)} /><Kpi label="Alcance" value={number.format(totals.reach)} /><Kpi label="Cliques" value={number.format(totals.clicks)} /><Kpi label="CTR" value={ctr === null ? "Indisponível pela Meta" : `${ctr.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} /><Kpi label="CPM" value={cpm === null ? "Indisponível pela Meta" : currency.format(cpm)} /><Kpi label="Leads Meta" value={number.format(totals.leads)} /><Kpi label="CPL" value={cpl === null ? "Indisponível pela Meta" : currency.format(cpl)} /><Kpi label="Frequência" value={frequency === null ? "Indisponível pela Meta" : frequency.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} /></section>
    <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <section className="gd-panel overflow-hidden"><div className="border-b border-border p-5"><h2 className="font-black">Anúncios pagos</h2><p className="mt-1 text-xs text-muted-foreground">Fonte: Meta Ads Insights · atualizado conforme o último ciclo de sincronização.</p></div>{insightsQuery.data?.length ? <div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="p-3 text-left">Campanha</th><th className="p-3 text-right">Investimento</th><th className="p-3 text-right">Impressões</th><th className="p-3 text-right">Cliques</th><th className="p-3 text-right">Leads</th></tr></thead><tbody className="divide-y divide-border">{insightsQuery.data.slice(0, 200).map((row) => <tr key={`${row.ad_id}-${row.date}`}><td className="max-w-80 truncate p-3" title={row.campaign_name}>{row.campaign_name || "Sem campanha"}</td><td className="p-3 text-right">{currency.format(Number(row.spend || 0))}</td><td className="p-3 text-right">{number.format(Number(row.impressions || 0))}</td><td className="p-3 text-right">{number.format(Number(row.clicks || 0))}</td><td className="p-3 text-right">{number.format(Number(row.leads || 0))}</td></tr>)}</tbody></table></div> : <StateCard title="Sem Insights no período" description="A Meta não retornou registros para esta conta e intervalo." />}</section>
      <section className="space-y-4"><div className="gd-panel p-5"><div className="flex items-center gap-2"><Instagram className="h-5 w-5 text-pink-500" /><h2 className="font-black">Instagram/Página</h2></div>{socialError ? <p className="mt-3 text-xs text-amber-600">Indisponível pela Meta: {socialError.message}</p> : socialAccounts.length ? <div className="mt-4 space-y-3">{socialAccounts.map((account) => <div key={account.id} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between gap-3"><div><b className="text-sm">{account.display_name}</b><p className="text-xs text-muted-foreground">@{account.username || "perfil"} · {account.connection_status}</p></div><Users className="h-4 w-4 text-primary" /></div><p className="mt-3 text-xl font-black">{number.format(Number(account.followers_count || 0))} <span className="text-xs font-normal text-muted-foreground">seguidores</span></p><p className="mt-1 text-[10px] text-muted-foreground">Última atualização: {account.last_sync_at ? format(new Date(account.last_sync_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca"}</p></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">Nenhum Instagram/Página vinculado a este workspace. Não há dados para exibir.</p>}</div><div className="gd-panel p-5"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-500" /><h2 className="font-black">Saúde da conexão</h2></div><div className="mt-4 space-y-2 text-xs"><p><b>OAuth:</b> {selectedAccount?.oauth_health_status === "healthy" ? "válido" : selectedAccount?.oauth_health_status || "não verificado"}</p><p><b>Permissões:</b> {selectedAccount?.oauth_permissions?.length ? selectedAccount.oauth_permissions.join(", ") : "Indisponível pela Meta"}</p><p><b>Último sync:</b> {selectedAccount?.last_sync_success_at ? format(new Date(selectedAccount.last_sync_success_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "nunca confirmado"}</p>{selectedAccount?.last_sync_error && <p className="text-rose-600"><b>Erro:</b> {selectedAccount.last_sync_error}</p>}</div></div></section>
    </section>
    <section className="grid gap-4 md:grid-cols-3"><section className="gd-panel p-5"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /><h2 className="font-black">Público e demografia</h2></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Idade, gênero, cidades e países aparecerão quando a API do ativo entregar essa permissão. A Growdash não estima esses dados.</p><p className="mt-3 text-xs font-bold text-amber-600">Indisponível pela Meta nesta sincronização.</p></section><section className="gd-panel p-5"><div className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><h2 className="font-black">Leads e eventos</h2></div><p className="mt-3 text-xs leading-5 text-muted-foreground">O recebimento em tempo real depende da configuração do webhook Lead Ads e da permissão `leads_retrieval`.</p><p className="mt-3 text-xs font-bold text-amber-600">Status do webhook: aguardando configuração.</p></section><section className="gd-panel p-5"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><h2 className="font-black">Rastreabilidade</h2></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Período, conta, fonte e última atualização ficam registrados em cada consulta. Dados RD não são usados nos cards Meta.</p></section></section>
  </div>;
}
