import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, CheckCircle2, Cloud, Code2, DatabaseZap, Facebook, FileText, FolderOpen, Instagram, Mail, MessageCircle, RefreshCw, Search, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeading } from "./shared";
import { cn } from "@/lib/utils";
import { recordRuntimeDiagnostic } from "@/lib/resilience";
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
import { useAuth } from "@/contexts/AuthContext";
import { useGoogleWorkspaceOAuth } from "@/hooks/useGoogleWorkspaceOAuth";
import { Textarea } from "@/components/ui/textarea";

const tabs = [
  ["paid", "Tráfego pago"], ["social", "Mídia social"], ["crm", "CRM & Vendas"], ["ai", "IA"], ["messaging", "Mensageria"],
  ["payments", "Pagamentos"], ["files", "Arquivos"], ["developers", "API & Webhooks"], ["health", "Saúde & Logs"],
] as const;

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function relativeDate(value?: unknown) {
  const normalizedValue = safeText(value);
  if (!normalizedValue) return "Nunca sincronizado";
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
}

type SafeAdAccount = {
  id: string;
  name: string;
  account_id: string;
  connection_status: string;
  last_sync_error: string | null;
  last_sync_error_code: number | null;
  last_sync_attempt_at: string | null;
  last_sync_success_at: string | null;
};

function normalizeAdAccounts(value: unknown): SafeAdAccount[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as Record<string, unknown>;
    const id = safeText(source.id);
    if (!id) return [];
    return [{
      id,
      name: safeText(source.name, "Conta Meta sem nome"),
      account_id: safeText(source.account_id, "ID indisponível"),
      connection_status: safeText(source.connection_status, "unknown"),
      last_sync_error: safeText(source.last_sync_error) || null,
      last_sync_error_code: typeof source.last_sync_error_code === "number" ? source.last_sync_error_code : null,
      last_sync_attempt_at: safeText(source.last_sync_attempt_at) || null,
      last_sync_success_at: safeText(source.last_sync_success_at) || null,
    }];
  });
}

/**
 * The integrations screen brings together several independently evolving
 * connectors. Keep an unexpected render error inside this screen instead of
 * letting it escape to the layout boundary (which previously replaced the
 * complete screen with the generic "módulo" error state).
 */
export default function IntegrationsPage() {
  const [attempt, setAttempt] = useState(0);

  return (
    <IntegrationRouteGuard key={attempt} onRetry={() => setAttempt((current) => current + 1)}>
      <IntegrationsContent />
    </IntegrationRouteGuard>
  );
}

function IntegrationsContent() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = tabs.some(([value]) => value === params.get("tab")) ? params.get("tab")! : "paid";
  const [search, setSearch] = useState("");
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string; account_id: string } | null>(null);
  const { data: adAccountsData, isLoading: loadingMeta } = useAdAccounts();
  const { data: rdIntegration, isLoading: loadingRD } = useRDIntegration();
  const { data: rdFunnelsData } = useRDFunnels(undefined, !!rdIntegration?.is_active);
  const connectMeta = useMetaOAuth();
  const connectInstagram = useInstagramOAuth();
  const connectGoogle = useGoogleWorkspaceOAuth();
  const syncMeta = useSyncMeta();

  const reconnectStoredMetaToken = useMutation({
    mutationFn: async (account: { id: string; name: string }) => {
      const { data, error } = await supabase.functions.invoke("meta-reconnect-stored-token", { body: { account_id: account.id } });
      if (error) throw new Error(data?.error || "Não foi possível validar o último token da Meta.");
      if (!data?.ok) throw new Error(data?.error || "A Meta não confirmou o último token.");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ad_accounts"] });
      toast({ title: "Conta reconectada", description: `${data.account.name} foi validada com o último token salvo.` });
    },
    onError: (error: Error) => toast({ title: "É necessário reconectar", description: error.message, variant: "destructive" }),
  });

  const { data: socialAccountsData, isLoading: loadingSocial } = useQuery({
    queryKey: ["social_accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("social_accounts").select("id,username,display_name,connection_status,last_sync_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });
  const { data: googleIntegration } = useQuery({
    queryKey: ["google_workspace_integration"], enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("id,provider,is_active,updated_at").eq("provider", "google_workspace").eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: latestRDDeal } = useQuery({
    queryKey: ["rd_latest_sync"], enabled: !!rdIntegration?.is_active,
    queryFn: async () => { const { data, error } = await supabase.from("rd_deals").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; },
  });

  // Supabase normally returns arrays for select queries. Normalize at the
  // screen boundary as a final safeguard: a malformed/legacy response must
  // not take the whole integrations route down.
  const adAccounts = useMemo(() => normalizeAdAccounts(adAccountsData), [adAccountsData]);
  const rdFunnels = useMemo(
    () => (Array.isArray(rdFunnelsData) ? rdFunnelsData.filter(isPresent) : []),
    [rdFunnelsData],
  );
  const socialAccounts = useMemo(
    () => (Array.isArray(socialAccountsData) ? socialAccountsData.filter(isPresent) : []),
    [socialAccountsData],
  );
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
        <div className="relative grow"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Buscar provedor ou recurso" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar provedor ou recurso…" /></div>
        <div className="flex gap-3 text-[10px] text-muted-foreground"><StatusDot tone="connected" label={`${adAccounts.length} conta(s) Meta`} /><StatusDot tone={rdConnected ? "connected" : "available"} label={rdConnected ? "RD conectado" : "RD disponível"} /></div>
      </div>

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/70 p-1">
          {tabs.map(([value, label]) => <TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="paid" className="space-y-4">
          <IntegrationPanelGuard name="Meta Ads e atribuição">
          {providerFilter("Meta Ads") && <section className="gd-panel overflow-hidden"><SectionHeader icon={<Facebook />} title="Meta Ads" description="OAuth oficial, conexão manual legada, contas, métricas, saldos e sincronização." status={loadingMeta ? "Verificando" : metaConnected ? "Conectado" : "Disponível"} connected={metaConnected} /><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{adAccounts.map((account) => <div key={account.id} className="group rounded-xl border border-border bg-muted/20 p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_45px_-28px_rgba(211,166,46,.8)]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><b className="block truncate text-sm">{account.name}</b><p className="truncate text-[10px] text-muted-foreground">{account.account_id}</p></div><div className="flex shrink-0 items-center gap-1">{account.connection_status === "error" || account.connection_status === "expired" ? <TriangleAlert className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => setAccountToDelete(account)} title={`Excluir ${account.name}`} aria-label={`Excluir ${account.name}`}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-3"><AccountConnectionStatus status={account.connection_status} errorMessage={account.last_sync_error} errorCode={account.last_sync_error_code} lastAttemptAt={account.last_sync_attempt_at} lastSuccessAt={account.last_sync_success_at} onReconnect={() => reconnectStoredMetaToken.mutate({ id: account.id, name: account.name })} /></div></div>)}{!loadingMeta && !adAccounts.length && <EmptyState text="Nenhuma conta Meta conectada." />}</div><div className="flex flex-wrap gap-2 border-t border-border p-4"><Button onClick={() => connectMeta.mutate()} disabled={connectMeta.isPending}><Facebook className="mr-2 h-4 w-4" />{connectMeta.isPending ? "Abrindo Meta…" : "Continuar com Facebook/Meta"}</Button><Button variant="outline" onClick={() => setMetaDialogOpen(true)}>Conectar por ID e token</Button><span className="ml-auto self-center text-[10px] text-muted-foreground">Último sucesso: {relativeDate(latestMetaSync as string | null)}</span></div></section>}
          <div className="grid gap-4 md:grid-cols-2">{providerFilter("Google Ads") && <ProviderCard name="Google Ads" description="Pesquisa, Performance Max, vídeo, conversões e orçamento." status="Preparar OAuth" />}{providerFilter("TikTok Ads") && <ProviderCard name="TikTok Ads" description="Campanhas, criativos, conversões e custo por resultado." status="Preparar OAuth" />}</div>
          <IntegrationAccordion title="Padrão de UTMs" description="Padronize a identificação de campanhas e origens." defaultOpen={false}><IntegrationPanelGuard name="Padrão de UTMs"><UTMConventionCard /></IntegrationPanelGuard></IntegrationAccordion>
          <IntegrationAccordion title="Mapeamento de UTMs" description="Revise como os parâmetros são associados aos dados." defaultOpen={false}><IntegrationPanelGuard name="Mapeamento de UTMs"><UTMMappingCard /></IntegrationPanelGuard></IntegrationAccordion>
          <IntegrationAccordion title="Plataformas e origens" description="Gerencie as regras de identificação por plataforma." defaultOpen={false}><IntegrationPanelGuard name="Plataformas e origens"><PlatformRulesSection /></IntegrationPanelGuard></IntegrationAccordion>
          <IntegrationAccordion title="Métricas personalizadas" description="Crie e ajuste métricas adicionais somente quando necessário." defaultOpen={false}><IntegrationPanelGuard name="Métricas personalizadas"><CustomMetricsSection /></IntegrationPanelGuard></IntegrationAccordion>
          </IntegrationPanelGuard>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <section className="gd-panel overflow-hidden">
            <SectionHeader icon={<Instagram />} title="Instagram profissional" description="Conteúdos, Reels, alcance, interações, salvamentos, compartilhamentos e crescimento de audiência via OAuth oficial." status={socialAccounts.length ? `${socialAccounts.length} conectado(s)` : "Disponível"} connected={socialAccounts.length > 0} />
            <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              {socialAccounts.map((account) => <article key={account.id} className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Instagram className="h-5 w-5" /></span><div className="min-w-0"><b className="block truncate text-sm">{account.display_name}</b><p className="truncate text-xs text-muted-foreground">@{account.username || "perfil"}</p></div><CheckCircle2 className="ml-auto h-5 w-5 text-emerald-500" /></div></article>)}
              {loadingSocial ? <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border p-5 text-xs text-muted-foreground" role="status" aria-live="polite">Verificando perfis conectados…</div> : !socialAccounts.length && <EmptyState text="Nenhum perfil profissional conectado." />}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border p-4"><Button onClick={() => connectInstagram.mutate()} disabled={connectInstagram.isPending}><Instagram className="mr-2 h-4 w-4" />{connectInstagram.isPending ? "Abrindo Instagram…" : "Conectar Instagram"}</Button><Button asChild variant="outline"><Link to="/midia-social">Abrir análise de mídia social</Link></Button><span className="ml-auto self-center text-[10px] text-muted-foreground">Somente contas Business ou Creator são suportadas pela API oficial.</span></div>
          </section>
        </TabsContent>

        <TabsContent value="crm" className="space-y-4">
          {providerFilter("RD Station") && <><section className="gd-panel overflow-hidden"><SectionHeader icon={<DatabaseZap />} title="RD Station CRM" description="OAuth, funis, etapas, negócios, campos personalizados e reconciliação." status={loadingRD ? "Verificando" : rdConnected ? "Conectado" : "Disponível"} connected={rdConnected} /><div className="p-5"><IntegrationPanelGuard name="Conexão com RD Station"><RDIntegrationCard /></IntegrationPanelGuard></div><div className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground">Última atualização: {relativeDate(latestRDDeal?.updated_at ?? rdIntegration?.updated_at)}</div></section><IntegrationAccordion title="Funis RD por conta" description="Vincule e acompanhe os funis que alimentam a Growdash."><IntegrationPanelGuard name="Funis RD por conta"><RDFunnelsSection /></IntegrationPanelGuard></IntegrationAccordion><IntegrationAccordion title="Campos personalizados do RD" description="Descoberta, faixas e exibição no dashboard." defaultOpen={false}><IntegrationPanelGuard name="Campos personalizados do RD"><RDCustomFieldsCard /></IntegrationPanelGuard></IntegrationAccordion></>}
          <div className="grid gap-4 md:grid-cols-2">{providerFilter("HubSpot") && <ProviderCard name="HubSpot" description="Contatos, negócios, pipelines e propriedades via OAuth." status="Planejado" />}{providerFilter("Pipedrive") && <ProviderCard name="Pipedrive" description="Negócios, etapas, atividades e receita via OAuth." status="Planejado" />}</div>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          {providerFilter("Growdash AI") && <section className="gd-panel overflow-hidden"><SectionHeader icon={<Bot />} title="Growdash AI — Analista de Tráfego" description="Cruza Meta Ads, vendas, período anterior, campanhas, conjuntos e anúncios sem expor credenciais no navegador." status="Ativo" connected /><div className="grid gap-3 p-5 md:grid-cols-3"><Feature label="Escopo seguro" text="Exige uma conta específica e respeita o período global." /><Feature label="Dados verificáveis" text="Não inventa público, posicionamento ou métricas ausentes." /><Feature label="Saída acionável" text="Resumo, rankings, plano de ação e projeções por cenário." /></div><div className="flex flex-wrap items-center gap-2 border-t border-border p-4"><Button asChild><Link to="/campanhas"><Sparkles className="mr-2 h-4 w-4" />Abrir analista</Link></Button><span className="text-[10px] text-muted-foreground">Processamento protegido pela função backend ask-ai.</span></div></section>}
          <ProviderGrid search={search} providers={[['OpenAI', 'Provedor adicional para análises e agentes com franquia de tokens.'], ['Claude', 'Provedor adicional para síntese extensa e raciocínio operacional.'], ['Gemini', 'Gateway atual usado pelo analista; conexão direta poderá ser adicionada por workspace.']]} icon={<Bot />} />
        </TabsContent>
        <TabsContent value="messaging"><ProviderGrid search={search} providers={[['WhatsApp Cloud API', 'Relatórios automáticos, alertas e mensagens transacionais.'], ['E-mail transacional', 'Recuperação, convites e alertas da operação.'], ['n8n', 'Automações via API e webhooks, respeitando licença comercial.']]} icon={<MessageCircle />} /></TabsContent>
        <TabsContent value="payments" className="space-y-4"><SalesWebhookGatewayCard /><ProviderGrid search={search} providers={[['Stripe', 'Assinaturas, checkout, faturas e portal do cliente.'], ['Asaas', 'Pix, boleto, cartão e cobrança recorrente no Brasil.'], ['Mercado Pago', 'Checkout e pagamentos locais.']]} icon={<Cloud />} /></TabsContent>
        <TabsContent value="files" className="space-y-4">
          {providerFilter("Google Drive") && <GoogleWorkspaceCard connected={!!googleIntegration} updatedAt={googleIntegration?.updated_at} pending={connectGoogle.isPending} onConnect={() => connectGoogle.mutate()} onOpen={() => setGoogleDialogOpen(true)} />}
          <ProviderGrid search={search} providers={[['Google Sheets', 'Importação, exportação e fontes auxiliares.'], ['OneDrive', 'Arquivos corporativos e compartilhamento.']]} icon={<FileText />} />
        </TabsContent>
        <TabsContent value="developers" className="space-y-4"><SalesWebhookGatewayCard /><ProviderGrid search={search} providers={[['API Growdash', 'Chaves com escopo, rotação e auditoria.'], ['Webhooks', 'Eventos assinados, tentativas e fila de falhas.'], ['MCP', 'Ferramentas seguras para agentes e assistentes.']]} icon={<Code2 />} /></TabsContent>
        <TabsContent value="health" className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><HealthCard title="Meta Ads" value={metaConnected ? relativeDate(latestMetaSync as string | null) : "Não conectado"} ok={metaConnected} /><HealthCard title="RD Station" value={rdConnected ? relativeDate(latestRDDeal?.updated_at) : "Não conectado"} ok={rdConnected} /><HealthCard title="Filas e webhooks" value="Monitoramento por execução" ok /></div>{rdConnected && <><IntegrationAccordion title="Diagnóstico do RD" description="Verifique a saúde, credenciais e sincronizações." defaultOpen={false}><RDHealthCheckCard /></IntegrationAccordion><IntegrationAccordion title="Reconciliação de vendas" description="Compare os dados de vendas importados e do RD." defaultOpen={false}><RDReconcileCard /></IntegrationAccordion><IntegrationAccordion title="Diagnóstico de UTMs" description="Identifique falhas de identificação de origem e campanha." defaultOpen={false}><RDUTMDiagnosticsCard /></IntegrationAccordion><IntegrationAccordion title="Observabilidade do RD" description="Consulte eventos e o histórico operacional da integração." defaultOpen={false}><RDObservabilityCard /></IntegrationAccordion></>}</TabsContent>
      </Tabs>

      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Conectar conta Meta Ads por ID e token</DialogTitle></DialogHeader><MetaManualConnectionCard onConnected={() => setMetaDialogOpen(false)} /></DialogContent></Dialog>
      <Dialog open={googleDialogOpen} onOpenChange={setGoogleDialogOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Google Drive e Gmail</DialogTitle></DialogHeader><GoogleWorkspaceManager /></DialogContent></Dialog>
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

import { SalesWebhookGatewayCard } from "@/components/settings/SalesWebhookGatewayCard";

function SectionHeader({ icon, title, description, status, connected }: { icon: React.ReactNode; title: string; description: string; status: string; connected: boolean }) { return <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div className="grow"><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div><span className={cn("w-fit rounded-full px-2 py-1 text-[9px] font-black uppercase", connected ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{status}</span></div>; }
function IntegrationAccordion({ title, description, defaultOpen = true, children }: { title: string; description: string; defaultOpen?: boolean; children: ReactNode }) { return <details className="gd-panel overflow-hidden" open={defaultOpen}><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><div className="min-w-0 grow"><h2 className="text-sm font-black">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><span className="shrink-0 text-xs font-semibold text-primary">Mostrar / recolher</span></summary><div className="border-t border-border p-4">{children}</div></details>; }
const AVAILABLE_PROVIDER_ROUTES: Record<string, { href: string; action: string }> = {
  "WhatsApp Cloud API": { href: "/campanhas?aba=campaigns&analise=intelligence&intelligence=whatsapp", action: "Configurar relatórios" },
  n8n: { href: "/automacoes", action: "Abrir automações" },
  Stripe: { href: "/perfil?tab=plans", action: "Gerenciar assinatura" },
};

function ProviderCard({ name, description, status, icon, href, action }: { name: string; description: string; status: string; icon?: React.ReactNode; href?: string; action?: string }) { return <article className="gd-panel flex min-h-40 flex-col p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">{icon ?? <Cloud className="h-5 w-5" />}</span><span className={cn("rounded-full px-2 py-1 text-[9px] font-black", href ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{status}</span></div><h3 className="mt-4 font-black">{name}</h3><p className="mt-1 grow text-xs text-muted-foreground">{description}</p>{href ? <Button asChild className="mt-4" variant="outline"><Link to={href}>{action || "Abrir configuração"}</Link></Button> : <Button className="mt-4" variant="outline" disabled title="O conector ainda exige implementação do backend e credenciais oficiais.">Em preparação — requer backend/OAuth</Button>}</article>; }
function ProviderGrid({ providers, search, icon }: { providers: string[][]; search: string; icon: React.ReactNode }) { const visible = providers.filter(([name]) => name.toLowerCase().includes(search.toLowerCase().trim())); return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(([name, description]) => { const available = AVAILABLE_PROVIDER_ROUTES[name]; return <ProviderCard key={name} name={name} description={description} status={available ? "Disponível" : "Planejado"} icon={icon} href={available?.href} action={available?.action} />; })}{!visible.length && <EmptyState text="Nenhuma integração corresponde à busca." />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border p-5 text-xs text-muted-foreground">{text}</div>; }
function isPresent<T>(value: T | null | undefined): value is T { return value !== null && value !== undefined; }
type IntegrationRouteGuardState = { error: Error | null };
class IntegrationRouteGuard extends Component<{ children: ReactNode; onRetry: () => void }, IntegrationRouteGuardState> {
  state: IntegrationRouteGuardState = { error: null };
  static getDerivedStateFromError(error: Error): IntegrationRouteGuardState { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Growdash integrations route error", error, info.componentStack);
    recordRuntimeDiagnostic("integrations-route", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <section className="gd-panel grid min-h-[52vh] place-items-center p-6 text-center" role="alert" aria-live="assertive"><div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-destructive/25 bg-destructive/10 text-destructive"><TriangleAlert className="h-5 w-5" /></span><h1 className="mt-4 text-lg font-black">Uma integração precisa de atenção</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">A Central de integrações não foi fechada nem apagada. Tente abrir os conectores novamente; se a falha persistir, o diagnóstico já fica registrado no navegador para correção.</p><div className="mt-5 flex justify-center"><Button type="button" onClick={this.props.onRetry}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></div></div></section>;
  }
}
type IntegrationPanelGuardState = { failed: boolean };
class IntegrationPanelGuard extends Component<{ children: ReactNode; name: string }, IntegrationPanelGuardState> {
  state: IntegrationPanelGuardState = { failed: false };
  static getDerivedStateFromError(): IntegrationPanelGuardState { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Growdash integration panel error: ${this.props.name}`, error, info.componentStack);
    recordRuntimeDiagnostic(`integrations-panel:${this.props.name}`, error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm"><b className="text-destructive">{this.props.name} não pôde ser exibido.</b><p className="mt-1 text-xs text-muted-foreground">Os demais conectores continuam disponíveis. Atualize esta página para tentar novamente.</p></div>;
  }
}
function StatusDot({ tone, label }: { tone: "connected" | "available"; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className={cn("h-2 w-2 rounded-full", tone === "connected" ? "bg-emerald-500" : "bg-muted-foreground")} />{label}</span>; }
function HealthCard({ title, value, ok }: { title: string; value: string; ok: boolean }) { return <div className="gd-panel p-4"><div className="flex items-center gap-2">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <TriangleAlert className="h-4 w-4 text-amber-500" />}<b className="text-sm">{title}</b></div><p className="mt-2 text-xs text-muted-foreground">{value}</p></div>; }
function Feature({ label, text }: { label: string; text: string }) { return <div className="rounded-xl border border-border bg-muted/20 p-4"><b className="text-xs">{label}</b><p className="mt-1 text-[11px] text-muted-foreground">{text}</p></div>; }

function GoogleWorkspaceCard({ connected, updatedAt, pending, onConnect, onOpen }: { connected: boolean; updatedAt?: string; pending: boolean; onConnect: () => void; onOpen: () => void }) {
  return <section className="gd-panel overflow-hidden"><SectionHeader icon={<FolderOpen />} title="Google Drive e Gmail" description="Acesse arquivos do seu Drive e envie e-mails pelo Gmail usando a autorização oficial do Google." status={connected ? "Conectado" : "Disponível"} connected={connected} /><div className="grid gap-3 p-5 md:grid-cols-3"><Feature label="Drive" text="Listar e enviar arquivos da conta Google conectada." /><Feature label="Gmail" text="Enviar e-mails pela conta autorizada, sem compartilhar senha." /><Feature label="Segurança" text="Tokens ficam no servidor e podem ser revogados no Google a qualquer momento." /></div><div className="flex flex-wrap items-center gap-2 border-t border-border p-4"><Button onClick={onConnect} disabled={pending}>{connected ? <Mail className="mr-2 h-4 w-4" /> : <FolderOpen className="mr-2 h-4 w-4" />}{pending ? "Abrindo Google…" : connected ? "Reconectar Google" : "Conectar Google"}</Button>{connected && <Button variant="outline" onClick={onOpen}><FolderOpen className="mr-2 h-4 w-4" />Abrir Drive e Gmail</Button>}<span className="ml-auto self-center text-[10px] text-muted-foreground">{connected ? `Atualizado ${relativeDate(updatedAt)}` : "Requer OAuth configurado no Google Cloud"}</span></div></section>;
}

function GoogleWorkspaceManager() {
  const { toast } = useToast();
  const [files, setFiles] = useState<Array<{ id: string; name: string; mimeType?: string; size?: string; webViewLink?: string; modifiedTime?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mail, setMail] = useState({ to: "", subject: "", html: "" });
  const loadFiles = async () => { setLoading(true); try { const { data, error } = await supabase.functions.invoke("google-drive-files", { body: { action: "list" } }); if (error || data?.error) throw error ?? new Error(data.error); setFiles(data.files ?? []); } catch (error) { toast({ title: "Não foi possível abrir o Drive", description: error instanceof Error ? error.message : "Erro inesperado", variant: "destructive" }); } finally { setLoading(false); } };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { toast({ title: "Arquivo muito grande", description: "Envie arquivos de até 10 MB.", variant: "destructive" }); return; } setUploading(true); try { const contentBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Não foi possível ler o arquivo.")); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.readAsDataURL(file); }); const { data, error } = await supabase.functions.invoke("google-drive-files", { body: { action: "upload", name: file.name, mimeType: file.type || "application/octet-stream", contentBase64 } }); if (error || data?.error) throw error ?? new Error(data.error); toast({ title: "Arquivo enviado", description: `${file.name} foi salvo no Google Drive.` }); await loadFiles(); } catch (error) { toast({ title: "Falha no envio", description: error instanceof Error ? error.message : "Erro inesperado", variant: "destructive" }); } finally { setUploading(false); event.target.value = ""; } };
  const send = async () => { setSending(true); try { const { data, error } = await supabase.functions.invoke("google-gmail-send", { body: mail }); if (error || data?.error) throw error ?? new Error(data.error); toast({ title: "E-mail enviado", description: `Mensagem enviada por ${data.from || "sua conta Google"}.` }); setMail({ to: "", subject: "", html: "" }); } catch (error) { toast({ title: "Falha no envio", description: error instanceof Error ? error.message : "Erro inesperado", variant: "destructive" }); } finally { setSending(false); } };
  return <Tabs defaultValue="drive" className="mt-2"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="drive">Google Drive</TabsTrigger><TabsTrigger value="gmail">Gmail</TabsTrigger></TabsList><TabsContent value="drive" className="space-y-4 pt-4"><div className="flex flex-wrap gap-2"><Button onClick={loadFiles} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />{loading ? "Carregando…" : "Atualizar arquivos"}</Button><Button asChild variant="outline" disabled={uploading}><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{uploading ? "Enviando…" : "Enviar para o Drive"}<input className="sr-only" type="file" onChange={upload} /></label></Button></div><div className="max-h-[380px] space-y-2 overflow-y-auto">{files.map((file) => <a key={file.id} href={file.webViewLink} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 transition hover:border-primary/40"><FolderOpen className="h-4 w-4 text-primary" /><span className="min-w-0 grow truncate text-sm font-semibold">{file.name}</span><span className="text-[10px] text-muted-foreground">{file.mimeType || "arquivo"}</span></a>)}{!files.length && !loading && <EmptyState text="Atualize para listar os arquivos do Drive conectado." />}</div></TabsContent><TabsContent value="gmail" className="space-y-3 pt-4"><Input value={mail.to} onChange={(event) => setMail((current) => ({ ...current, to: event.target.value }))} placeholder="Destinatário" type="email" /><Input value={mail.subject} onChange={(event) => setMail((current) => ({ ...current, subject: event.target.value }))} placeholder="Assunto" /><Textarea value={mail.html} onChange={(event) => setMail((current) => ({ ...current, html: event.target.value }))} placeholder="Mensagem" className="min-h-40" /><Button onClick={send} disabled={sending || !mail.to || !mail.subject || !mail.html}><Mail className="mr-2 h-4 w-4" />{sending ? "Enviando…" : "Enviar pelo Gmail"}</Button><p className="text-[10px] text-muted-foreground">O e-mail é enviado pela conta Google que você autorizou nesta plataforma.</p></TabsContent></Tabs>;
}
