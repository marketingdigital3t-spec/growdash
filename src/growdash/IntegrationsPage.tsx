import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, CheckCircle2, Cloud, Code2, DatabaseZap, Facebook, FileText, Instagram, MessageCircle, RefreshCw, Search, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeading } from "./shared";
import { cn } from "@/lib/utils";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDIntegration } from "@/hooks/useRDIntegration";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useMetaOAuth } from "@/hooks/useMetaOAuth";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RDIntegrationCard } from "@/components/settings/RDIntegrationCard";
import { RDFunnelsSection } from "@/components/settings/RDFunnelsSection";
import { RDCustomFieldsCard } from "@/components/settings/RDCustomFieldsCard";
import { RDHealthCheckCard } from "@/components/settings/RDHealthCheckCard";
import { RDReconcileCard } from "@/components/settings/RDReconcileCard";
import { RDUTMDiagnosticsCard } from "@/components/settings/RDUTMDiagnosticsCard";
import { RDObservabilityCard } from "@/components/settings/RDObservabilityCard";
import { MetaManualConnectionCard } from "@/components/settings/MetaManualConnectionCard";
import { UTMConventionCard } from "@/components/settings/UTMConventionCard";
import { UTMMappingCard } from "@/components/settings/UTMMappingCard";
import { PlatformRulesSection } from "@/components/settings/PlatformRulesSection";
import { CustomMetricsSection } from "@/components/settings/CustomMetricsSection";
import { AccountConnectionStatus } from "@/components/settings/AccountConnectionStatus";
import { DestructiveConfirmationDialog } from "@/components/DestructiveConfirmationDialog";
import { useInstagramOAuth } from "@/hooks/useInstagramOAuth";

const tabs = [
  ["paid", "Tráfego pago"], ["social", "Mídia social"], ["crm", "CRM & Vendas"], ["ai", "IA"], ["messaging", "Mensageria"],
  ["payments", "Pagamentos"], ["files", "Arquivos"], ["developers", "API & Webhooks"], ["health", "Saúde & Logs"],
] as const;

function relativeDate(value?: string | null) {
  if (!value) return "Nunca sincronizado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([value]) => value === params.get("tab")) ? params.get("tab")! : "paid";
  const [search, setSearch] = useState("");
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string; account_id: string } | null>(null);
  const { data: adAccounts = [], isLoading: loadingMeta } = useAdAccounts();
  const { data: rdIntegration, isLoading: loadingRD } = useRDIntegration();
  const { data: rdFunnels = [] } = useRDFunnels();
  const connectMeta = useMetaOAuth();
  const connectInstagram = useInstagramOAuth();
  const syncMeta = useSyncMeta();

  const { data: socialAccounts = [] } = useQuery({
    queryKey: ["social_accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("social_accounts").select("id,username,display_name,connection_status,last_sync_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });

  const { data: latestRDDeal } = useQuery({
    queryKey: ["rd_latest_sync"], enabled: !!rdIntegration?.is_active,
    queryFn: async () => { const { data, error } = await (supabase as any).from("rd_deals").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; },
  });

  const metaConnected = adAccounts.length > 0;
  const rdConnected = !!rdIntegration?.is_active;
  const activeRDFunnels = rdFunnels.filter((funnel) => funnel.is_active && funnel.rd_funnel_id);
  const latestMetaSync = useMemo(() => adAccounts.map((account) => account.last_sync_success_at).filter(Boolean).sort().at(-1) ?? null, [adAccounts]);

  const syncAll = useMutation({
    mutationFn: async () => {
      if (!metaConnected && !rdConnected) throw new Error("Conecte ao menos uma fonte antes de sincronizar.");
      if (metaConnected) await syncMeta.mutateAsync({ startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"), endDate: format(new Date(), "yyyy-MM-dd") });
      if (rdConnected) for (const funnel of activeRDFunnels) { const { data, error } = await supabase.functions.invoke("rd-sync-deals", { body: { funnel_id: funnel.id } }); if (error) throw error; if (data?.error) throw new Error(data.error); }
    },
    onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Sincronização concluída", description: "As fontes conectadas foram atualizadas." }); },
    onError: (error: Error) => toast({ title: "Falha na sincronização", description: error.message, variant: "destructive" }),
  });

  const deleteMetaAccount = useMutation({
    mutationFn: async () => {
      if (!accountToDelete) throw new Error("Selecione a conta que deseja excluir.");
      const { data, error } = await supabase.functions.invoke("delete-integration-account", {
        body: {
          provider: "meta",
          account_id: accountToDelete.id,
          confirmation: accountToDelete.name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Conta removida da Growdash", description: data?.message });
      setAccountToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["rd_funnels"] });
    },
    onError: (error: Error) => toast({ title: "Não foi possível excluir", description: error.message, variant: "destructive" }),
  });

  const providerFilter = (name: string) => name.toLowerCase().includes(search.toLowerCase().trim());

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeading eyebrow="Administração" title="Central de integrações" description="Conecte mídia, CRM, IA, mensageria e dados com credenciais protegidas e saúde monitorada." actions={<Button onClick={() => syncAll.mutate()} disabled={syncAll.isPending || (!metaConnected && !rdConnected)}><RefreshCw className={cn("mr-2 h-4 w-4", syncAll.isPending && "animate-spin")} />{syncAll.isPending ? "Sincronizando…" : "Sincronizar tudo"}</Button>} />

      <div className="gd-panel mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative grow"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar provedor ou recurso…" /></div>
        <div className="flex gap-3 text-[10px] text-muted-foreground"><StatusDot tone="connected" label={`${adAccounts.length} conta(s) Meta`} /><StatusDot tone={rdConnected ? "connected" : "available"} label={rdConnected ? "RD conectado" : "RD disponível"} /></div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/70 p-1">
          {tabs.map(([value, label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="paid" className="space-y-4">
          {providerFilter("Meta Ads") && <section className="gd-panel overflow-hidden"><SectionHeader icon={<Facebook />} title="Meta Ads" description="OAuth oficial, conexão manual legada, contas, métricas, saldos e sincronização." status={loadingMeta ? "Verificando" : metaConnected ? "Conectado" : "Disponível"} connected={metaConnected} /><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{adAccounts.map((account) => <div key={account.id} className="group rounded-xl border border-border bg-muted/20 p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_45px_-28px_rgba(211,166,46,.8)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{account.name}</b><p className="truncate text-[10px] text-muted-foreground">{account.account_id}</p></div><div className="flex shrink-0 items-center gap-1">{account.connection_status === "error" || account.connection_status === "expired" ? <TriangleAlert className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setAccountToDelete(account)} title={`Excluir ${account.name}`} aria-label={`Excluir ${account.name}`}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-3"><AccountConnectionStatus status={account.connection_status} errorMessage={account.last_sync_error} errorCode={account.last_sync_error_code} lastAttemptAt={account.last_sync_attempt_at} lastSuccessAt={account.last_sync_success_at} onReconnect={() => connectMeta.mutate()} /></div></div>)}{!loadingMeta && !adAccounts.length && <EmptyState text="Nenhuma conta Meta conectada." />}</div><div className="flex flex-wrap gap-2 border-t border-border p-4"><Button onClick={() => connectMeta.mutate()} disabled={connectMeta.isPending}><Facebook className="mr-2 h-4 w-4" />{connectMeta.isPending ? "Abrindo Meta…" : "Continuar com Facebook/Meta"}</Button><Button variant="outline" onClick={() => setMetaDialogOpen(true)}>Conectar por ID e token</Button><span className="ml-auto self-center text-[10px] text-muted-foreground">Último sucesso: {relativeDate(latestMetaSync as string | null)}</span></div></section>}
          <div className="grid gap-4 md:grid-cols-2">{providerFilter("Google Ads") && <ProviderCard name="Google Ads" description="Pesquisa, Performance Max, vídeo, conversões e orçamento." status="Preparar OAuth" />}{providerFilter("TikTok Ads") && <ProviderCard name="TikTok Ads" description="Campanhas, criativos, conversões e custo por resultado." status="Preparar OAuth" />}</div>
          <details className="gd-panel p-5"><summary className="cursor-pointer font-black">Atribuição, UTMs e métricas avançadas</summary><div className="mt-5 space-y-4"><UTMConventionCard /><UTMMappingCard /><PlatformRulesSection /><CustomMetricsSection /></div></details>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <section className="gd-panel overflow-hidden">
            <SectionHeader icon={<Instagram />} title="Instagram profissional" description="Conteúdos, Reels, alcance, interações, salvamentos, compartilhamentos e crescimento de audiência via OAuth oficial." status={socialAccounts.length ? `${socialAccounts.length} conectado(s)` : "Disponível"} connected={socialAccounts.length > 0} />
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {socialAccounts.map((account) => <article key={account.id} className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Instagram className="h-5 w-5" /></span><div className="min-w-0"><b className="block truncate text-sm">{account.display_name}</b><p className="truncate text-xs text-muted-foreground">@{account.username || "perfil"}</p></div><CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" /></div></article>)}
              {!socialAccounts.length && <EmptyState text="Nenhum perfil profissional conectado." />}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-4"><Button onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}><Instagram className="mr-2 h-4 w-4" />{connectInstagram.isPending ? "Abrindo Instagram…" : "Conectar Instagram"}</Button><Button asChild variant="outline"><Link to="/midia-social">Abrir análise de mídia social</Link></Button><span className="ml-auto self-center text-[10px] text-muted-foreground">Somente contas Business ou Creator são suportadas pela API oficial.</span></div>
          </section>
        </TabsContent>

        <TabsContent value="crm" className="space-y-4">
          {providerFilter("RD Station") && <><section className="gd-panel overflow-hidden"><SectionHeader icon={<DatabaseZap />} title="RD Station CRM" description="OAuth, funis, etapas, negócios, campos personalizados e reconciliação." status={loadingRD ? "Verificando" : rdConnected ? "Conectado" : "Disponível"} connected={rdConnected} /><div className="p-5"><RDIntegrationCard /></div><div className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground">Última atualização: {relativeDate(latestRDDeal?.updated_at ?? rdIntegration?.updated_at)}</div></section><RDFunnelsSection /><RDCustomFieldsCard /></>}
          <div className="grid gap-4 md:grid-cols-2">{providerFilter("HubSpot") && <ProviderCard name="HubSpot" description="Contatos, negócios, pipelines e propriedades via OAuth." status="Planejado" />}{providerFilter("Pipedrive") && <ProviderCard name="Pipedrive" description="Negócios, etapas, atividades e receita via OAuth." status="Planejado" />}</div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          {providerFilter("Growdash AI") && <section className="gd-panel overflow-hidden"><SectionHeader icon={<Bot />} title="Growdash AI — Analista de Tráfego" description="Cruza Meta Ads, vendas, período anterior, campanhas, conjuntos e anúncios sem expor credenciais no navegador." status="Ativo" connected /><div className="grid gap-3 p-5 md:grid-cols-3"><Feature label="Escopo seguro" text="Exige uma conta específica e respeita o período global." /><Feature label="Dados verificáveis" text="Não inventa público, posicionamento ou métricas ausentes." /><Feature label="Saída acionável" text="Resumo, rankings, plano de ação e projeções por cenário." /></div><div className="flex flex-wrap items-center gap-2 border-t border-border p-4"><Button asChild><Link to="/campanhas"><Sparkles className="mr-2 h-4 w-4" />Abrir analista</Link></Button><span className="text-[10px] text-muted-foreground">Processamento protegido pela função backend ask-ai.</span></div></section>}
          <ProviderGrid search={search} providers={[['OpenAI', 'Provedor adicional para análises e agentes com franquia de tokens.'], ['Claude', 'Provedor adicional para síntese extensa e raciocínio operacional.'], ['Gemini', 'Gateway atual usado pelo analista; conexão direta poderá ser adicionada por workspace.']]} icon={<Bot />} />
        </TabsContent>
        <TabsContent value="messaging"><ProviderGrid search={search} providers={[['WhatsApp Cloud API', 'Relatórios automáticos, alertas e mensagens transacionais.'], ['E-mail transacional', 'Recuperação, convites e alertas da operação.'], ['n8n', 'Automações via API e webhooks, respeitando licença comercial.']]} icon={<MessageCircle />} /></TabsContent>
        <TabsContent value="payments"><ProviderGrid search={search} providers={[['Stripe', 'Assinaturas, checkout, faturas e portal do cliente.'], ['Asaas', 'Pix, boleto, cartão e cobrança recorrente no Brasil.'], ['Mercado Pago', 'Checkout e pagamentos locais.']]} icon={<Cloud />} /></TabsContent>
        <TabsContent value="files"><ProviderGrid search={search} providers={[['Google Drive', 'Relatórios, criativos e documentos do workspace.'], ['Google Sheets', 'Importação, exportação e fontes auxiliares.'], ['OneDrive', 'Arquivos corporativos e compartilhamento.']]} icon={<FileText />} /></TabsContent>
        <TabsContent value="developers"><ProviderGrid search={search} providers={[['API Growdash', 'Chaves com escopo, rotação e auditoria.'], ['Webhooks', 'Eventos assinados, tentativas e fila de falhas.'], ['MCP', 'Ferramentas seguras para agentes e assistentes.']]} icon={<Code2 />} /></TabsContent>
        <TabsContent value="health" className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><HealthCard title="Meta Ads" value={metaConnected ? relativeDate(latestMetaSync as string | null) : "Não conectado"} ok={metaConnected} /><HealthCard title="RD Station" value={rdConnected ? relativeDate(latestRDDeal?.updated_at) : "Não conectado"} ok={rdConnected} /><HealthCard title="Filas e webhooks" value="Monitoramento por execução" ok /></div>{rdConnected && <><RDHealthCheckCard /><RDReconcileCard /><RDUTMDiagnosticsCard /><RDObservabilityCard /></>}</TabsContent>
      </Tabs>

      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Conectar conta Meta Ads por ID e token</DialogTitle></DialogHeader><MetaManualConnectionCard onConnected={() => setMetaDialogOpen(false)} /></DialogContent></Dialog>
      <DestructiveConfirmationDialog
        open={!!accountToDelete}
        onOpenChange={(open) => !open && setAccountToDelete(null)}
        title="Excluir conta de tráfego pago"
        description="Isso remove da Growdash a credencial, campanhas, anúncios e métricas sincronizadas desta conexão. A conta real e as campanhas continuam existindo no Gerenciador de Anúncios da Meta."
        confirmation={accountToDelete?.name ?? ""}
        pending={deleteMetaAccount.isPending}
        onConfirm={() => deleteMetaAccount.mutate()}
      />
    </div>
  );
}

function SectionHeader({ icon, title, description, status, connected }: { icon: React.ReactNode; title: string; description: string; status: string; connected: boolean }) { return <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div className="grow"><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div><span className={cn("w-fit rounded-full px-2 py-1 text-[9px] font-black uppercase", connected ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{status}</span></div>; }
function ProviderCard({ name, description, status, icon }: { name: string; description: string; status: string; icon?: React.ReactNode }) { return <article className="gd-panel flex min-h-40 flex-col p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">{icon ?? <Cloud className="h-5 w-5" />}</span><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black text-muted-foreground">{status}</span></div><h3 className="mt-4 font-black">{name}</h3><p className="mt-1 grow text-xs text-muted-foreground">{description}</p><Button className="mt-4" variant="outline" disabled>Configuração do provedor necessária</Button></article>; }
function ProviderGrid({ providers, search, icon }: { providers: string[][]; search: string; icon: React.ReactNode }) { const visible = providers.filter(([name]) => name.toLowerCase().includes(search.toLowerCase().trim())); return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(([name, description]) => <ProviderCard key={name} name={name} description={description} status="Planejado" icon={icon} />)}{!visible.length && <EmptyState text="Nenhuma integração corresponde à busca." />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border p-5 text-xs text-muted-foreground">{text}</div>; }
function StatusDot({ tone, label }: { tone: "connected" | "available"; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className={cn("h-2 w-2 rounded-full", tone === "connected" ? "bg-emerald-500" : "bg-muted-foreground")} />{label}</span>; }
function HealthCard({ title, value, ok }: { title: string; value: string; ok: boolean }) { return <div className="gd-panel p-4"><div className="flex items-center gap-2">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <TriangleAlert className="h-4 w-4 text-amber-500" />}<b className="text-sm">{title}</b></div><p className="mt-2 text-xs text-muted-foreground">{value}</p></div>; }
function Feature({ label, text }: { label: string; text: string }) { return <div className="rounded-xl border border-border bg-muted/20 p-4"><b className="text-xs">{label}</b><p className="mt-1 text-[11px] text-muted-foreground">{text}</p></div>; }
