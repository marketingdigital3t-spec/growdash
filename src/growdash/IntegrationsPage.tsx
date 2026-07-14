import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, CheckCircle2, Cloud, Code2, DatabaseZap, Facebook, FileText, MessageCircle, RefreshCw, Search, TriangleAlert, Webhook } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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

const tabs = [
  ["paid", "Tráfego pago"], ["crm", "CRM & Vendas"], ["ai", "IA"], ["messaging", "Mensageria"],
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
  const { data: adAccounts = [], isLoading: loadingMeta } = useAdAccounts();
  const { data: rdIntegration, isLoading: loadingRD } = useRDIntegration();
  const { data: rdFunnels = [] } = useRDFunnels();
  const connectMeta = useMetaOAuth();
  const syncMeta = useSyncMeta();

  const { data: latestRDDeal } = useQuery({
    queryKey: ["rd_latest_sync"], enabled: !!rdIntegration?.is_active,
    queryFn: async () => { const { data, error } = await supabase.from("rd_deals").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data; },
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
          {providerFilter("Meta Ads") && <section className="gd-panel overflow-hidden"><SectionHeader icon={<Facebook />} title="Meta Ads" description="OAuth oficial, conexão manual legada, contas, métricas, saldos e sincronização." status={loadingMeta ? "Verificando" : metaConnected ? "Conectado" : "Disponível"} connected={metaConnected} /><div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{adAccounts.map((account) => <div key={account.id} className="rounded-xl border border-border bg-muted/20 p-4"><div className="flex items-center justify-between"><div><b className="text-sm">{account.name}</b><p className="text-[10px] text-muted-foreground">{account.account_id}</p></div>{account.connection_status === "error" || account.connection_status === "expired" ? <TriangleAlert className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</div><div className="mt-3"><AccountConnectionStatus status={account.connection_status} errorMessage={account.last_sync_error} errorCode={account.last_sync_error_code} lastAttemptAt={account.last_sync_attempt_at} lastSuccessAt={account.last_sync_success_at} onReconnect={() => connectMeta.mutate()} /></div></div>)}{!loadingMeta && !adAccounts.length && <EmptyState text="Nenhuma conta Meta conectada." />}</div><div className="flex flex-wrap gap-2 border-t border-border p-4"><Button onClick={() => connectMeta.mutate()} disabled={connectMeta.isPending}><Facebook className="mr-2 h-4 w-4" />{connectMeta.isPending ? "Abrindo Meta…" : "Continuar com Facebook/Meta"}</Button><Button variant="outline" onClick={() => setMetaDialogOpen(true)}>Conectar por ID e token</Button><span className="ml-auto self-center text-[10px] text-muted-foreground">Último sucesso: {relativeDate(latestMetaSync as string | null)}</span></div></section>}
          <div className="grid gap-4 md:grid-cols-2">{providerFilter("Google Ads") && <ProviderCard name="Google Ads" description="Pesquisa, Performance Max, vídeo, conversões e orçamento." status="Preparar OAuth" />}{providerFilter("TikTok Ads") && <ProviderCard name="TikTok Ads" description="Campanhas, criativos, conversões e custo por resultado." status="Preparar OAuth" />}</div>
          <details className="gd-panel p-5"><summary className="cursor-pointer font-black">Atribuição, UTMs e métricas avançadas</summary><div className="mt-5 space-y-4"><UTMConventionCard /><UTMMappingCard /><PlatformRulesSection /><CustomMetricsSection /></div></details>
        </TabsContent>

        <TabsContent value="crm" className="space-y-4">
          {providerFilter("RD Station") && <><section className="gd-panel overflow-hidden"><SectionHeader icon={<DatabaseZap />} title="RD Station CRM" description="OAuth, funis, etapas, negócios, campos personalizados e reconciliação." status={loadingRD ? "Verificando" : rdConnected ? "Conectado" : "Disponível"} connected={rdConnected} /><div className="p-5"><RDIntegrationCard /></div><div className="border-t border-border px-5 py-3 text-[10px] text-muted-foreground">Última atualização: {relativeDate(latestRDDeal?.updated_at ?? rdIntegration?.updated_at)}</div></section><RDFunnelsSection /><RDCustomFieldsCard /></>}
          <div className="grid gap-4 md:grid-cols-2">{providerFilter("HubSpot") && <ProviderCard name="HubSpot" description="Contatos, negócios, pipelines e propriedades via OAuth." status="Planejado" />}{providerFilter("Pipedrive") && <ProviderCard name="Pipedrive" description="Negócios, etapas, atividades e receita via OAuth." status="Planejado" />}</div>
        </TabsContent>

        <TabsContent value="ai"><ProviderGrid search={search} providers={[['OpenAI', 'Análises, chat e agentes com franquia de tokens.'], ['Claude', 'Análises extensas e síntese operacional.'], ['Gemini', 'Modelos Google para texto e multimodalidade.']]} icon={<Bot />} /></TabsContent>
        <TabsContent value="messaging"><ProviderGrid search={search} providers={[['WhatsApp Cloud API', 'Relatórios automáticos, alertas e mensagens transacionais.'], ['E-mail transacional', 'Recuperação, convites e alertas da operação.'], ['n8n', 'Automações via API e webhooks, respeitando licença comercial.']]} icon={<MessageCircle />} /></TabsContent>
        <TabsContent value="payments"><ProviderGrid search={search} providers={[['Stripe', 'Assinaturas, checkout, faturas e portal do cliente.'], ['Asaas', 'Pix, boleto, cartão e cobrança recorrente no Brasil.'], ['Mercado Pago', 'Checkout e pagamentos locais.']]} icon={<Cloud />} /></TabsContent>
        <TabsContent value="files"><ProviderGrid search={search} providers={[['Google Drive', 'Relatórios, criativos e documentos do workspace.'], ['Google Sheets', 'Importação, exportação e fontes auxiliares.'], ['OneDrive', 'Arquivos corporativos e compartilhamento.']]} icon={<FileText />} /></TabsContent>
        <TabsContent value="developers"><ProviderGrid search={search} providers={[['API Growdash', 'Chaves com escopo, rotação e auditoria.'], ['Webhooks', 'Eventos assinados, tentativas e fila de falhas.'], ['MCP', 'Ferramentas seguras para agentes e assistentes.']]} icon={<Code2 />} /></TabsContent>
        <TabsContent value="health" className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><HealthCard title="Meta Ads" value={metaConnected ? relativeDate(latestMetaSync as string | null) : "Não conectado"} ok={metaConnected} /><HealthCard title="RD Station" value={rdConnected ? relativeDate(latestRDDeal?.updated_at) : "Não conectado"} ok={rdConnected} /><HealthCard title="Filas e webhooks" value="Monitoramento por execução" ok /></div>{rdConnected && <><RDHealthCheckCard /><RDReconcileCard /><RDUTMDiagnosticsCard /><RDObservabilityCard /></>}</TabsContent>
      </Tabs>

      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Conectar conta Meta Ads por ID e token</DialogTitle></DialogHeader><MetaManualConnectionCard onConnected={() => setMetaDialogOpen(false)} /></DialogContent></Dialog>
    </div>
  );
}

function SectionHeader({ icon, title, description, status, connected }: { icon: React.ReactNode; title: string; description: string; status: string; connected: boolean }) { return <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span><div className="grow"><h2 className="font-black">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div><span className={cn("w-fit rounded-full px-2 py-1 text-[9px] font-black uppercase", connected ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>{status}</span></div>; }
function ProviderCard({ name, description, status, icon }: { name: string; description: string; status: string; icon?: React.ReactNode }) { return <article className="gd-panel flex min-h-40 flex-col p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">{icon ?? <Cloud className="h-5 w-5" />}</span><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black text-muted-foreground">{status}</span></div><h3 className="mt-4 font-black">{name}</h3><p className="mt-1 grow text-xs text-muted-foreground">{description}</p><Button className="mt-4" variant="outline" disabled>Configuração do provedor necessária</Button></article>; }
function ProviderGrid({ providers, search, icon }: { providers: string[][]; search: string; icon: React.ReactNode }) { const visible = providers.filter(([name]) => name.toLowerCase().includes(search.toLowerCase().trim())); return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(([name, description]) => <ProviderCard key={name} name={name} description={description} status="Planejado" icon={icon} />)}{!visible.length && <EmptyState text="Nenhuma integração corresponde à busca." />}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-border p-5 text-xs text-muted-foreground">{text}</div>; }
function StatusDot({ tone, label }: { tone: "connected" | "available"; label: string }) { return <span className="inline-flex items-center gap-1.5"><i className={cn("h-2 w-2 rounded-full", tone === "connected" ? "bg-emerald-500" : "bg-muted-foreground")} />{label}</span>; }
function HealthCard({ title, value, ok }: { title: string; value: string; ok: boolean }) { return <div className="gd-panel p-4"><div className="flex items-center gap-2">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <TriangleAlert className="h-4 w-4 text-amber-500" />}<b className="text-sm">{title}</b></div><p className="mt-2 text-xs text-muted-foreground">{value}</p></div>; }
