import { useMemo, useState } from "react";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDDeals, useFunnelStages, computeFunnelAnalytics } from "@/hooks/useRDDeals";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MetaDateRangePicker } from "@/components/dashboard/MetaDateRangePicker";
import { FunnelKPIs } from "@/components/funnel-analysis/FunnelKPIs";
import { FunnelStageDistribution } from "@/components/funnel-analysis/FunnelStageDistribution";
import { FunnelStageConversion } from "@/components/funnel-analysis/FunnelStageConversion";
import { FunnelLeadsEvolution } from "@/components/funnel-analysis/FunnelLeadsEvolution";
import { FunnelBottlenecks } from "@/components/funnel-analysis/FunnelBottlenecks";
import { FunnelSourceTable } from "@/components/funnel-analysis/FunnelSourceTable";
import { FunnelLostReasons } from "@/components/funnel-analysis/FunnelLostReasons";
import { FunnelStateMap } from "@/components/funnel-analysis/FunnelStateMap";
import { FunnelAutoInsights } from "@/components/funnel-analysis/FunnelAutoInsights";
import { FunnelWeekdayChart } from "@/components/funnel-analysis/FunnelWeekdayChart";
import { FunnelHourChart } from "@/components/funnel-analysis/FunnelHourChart";
import { FunnelMediaOverview } from "@/components/funnel-analysis/FunnelMediaOverview";
import { RefreshCw, Filter, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRDHealthCheck } from "@/hooks/useRDHealthCheck";
import { useInsights } from "@/hooks/useInsights";
import { useSyncMeta } from "@/hooks/useSyncMeta";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { computeFunnelMediaMetrics } from "@/lib/funnelMediaMetrics";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { edgeFunctionErrorDetails, formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import { MetricHelpTooltip } from "@/components/help/MetricHelpTooltip";

const blockHelp = {
  media: ["Meta Ads × RD Station", "Compara investimento e resultados da Meta com os leads e vendas encontrados no RD Station para a mesma seleção.", "Use a cobertura para identificar diferenças de atribuição, UTMs ou sincronização entre as fontes."],
  distribution: ["Distribuição por etapa do funil", "Mostra quantos leads estão em cada etapa do RD, sua participação, tempo médio e valor em negociação."],
  conversion: ["Taxa de avanço entre etapas", "Calcula a passagem entre etapas consecutivas e destaca onde o funil perde mais leads."],
  evolution: ["Evolução do funil", "Exibe a variação diária de leads, oportunidades e vendas no período selecionado."],
  bottlenecks: ["Gargalos do funil", "Aponta a maior queda de conversão e quantos leads estão parados há mais de 3, 7 e 15 dias."],
  sources: ["Origem dos leads", "Compara volume, vendas, conversão e receita por origem para revelar os canais de maior qualidade."],
  losses: ["Motivos de perda", "Agrupa os motivos registrados no RD para mostrar por que as negociações não avançaram."],
  insights: ["Insights automáticos", "Transforma padrões do funil em observações acionáveis sobre origem, gargalos, região e tempo parado."],
  states: ["Mapa por estado", "Distribui leads e conversões geograficamente para identificar regiões com maior volume e eficiência."],
  weekdays: ["Dias que mais convertem", "Compara conversões e receita por dia da semana usando a data dos eventos do RD."],
  hours: ["Melhor período do dia", "Compara manhã, tarde, noite e madrugada; clique em um período para detalhar as vendas por hora."],
} as const;

function HelpBlock({ help, children, className }: { help: readonly string[]; children: React.ReactNode; className?: string }) {
  return (
    <MetricHelpTooltip title={help[0]} description={help[1]} detail={help[2]} className={className ?? "h-full"} showHint>
      {children}
    </MetricHelpTooltip>
  );
}

export default function FunnelAnalysis() {
  const { adAccountId, setAdAccountId, businessUnitId, segment, preset, setPreset, customRange, setCustomRange, startDate, endDate } = useGlobalFilters();
  const { data: adAccounts = [] } = useAdAccounts();
  const visibleAccounts = useMemo(() => businessUnitId
    ? adAccounts.filter((account) => account.business_unit_id === businessUnitId || (segment === "infoproduto" && !account.business_unit_id))
    : adAccounts, [adAccounts, businessUnitId, segment]);
  const { data: funnels = [], isLoading: loadingFunnels } = useRDFunnels(adAccountId === "all" ? undefined : adAccountId);
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();
  const syncMeta = useSyncMeta();

  const activeFunnels = funnels.filter((f) => f.is_active && f.rd_funnel_id);
  const selectedFunnelRecord = activeFunnels[0];
  const funnelId = selectedFunnelRecord?.id || "";
  const effectiveAdAccountId = adAccountId === "all" ? selectedFunnelRecord?.ad_account_id : adAccountId;

  const { data: stages = [], isLoading: loadingStages } = useFunnelStages(funnelId);
  const { data: deals = [], isLoading, refetch } = useRDDeals({
    funnelId,
    startDate,
    endDate,
    source: selectedSource,
    campaign: selectedCampaign,
    state: selectedState,
    owner: selectedOwner,
    product: selectedProduct,
    enabled: !!funnelId,
  });

  // Para popular filtros, precisamos do superset (sem filtro). Usamos os deals atuais como aproximação.
  const sources = useMemo(() => Array.from(new Set(deals.map((d) => d.utm_source).filter(Boolean) as string[])).sort(), [deals]);
  const campaigns = useMemo(() => Array.from(new Set(deals.map((d) => d.utm_campaign).filter(Boolean) as string[])).sort(), [deals]);
  const states = useMemo(() => Array.from(new Set(deals.map((d) => d.lead_state).filter(Boolean) as string[])).sort(), [deals]);
  const owners = useMemo(() => Array.from(new Set(deals.map((d) => d.deal_owner_name).filter(Boolean) as string[])).sort(), [deals]);
  const products = useMemo(() => Array.from(new Set(deals.map((d) => d.rd_product_name).filter(Boolean) as string[])).sort(), [deals]);

  const analytics = useMemo(() => computeFunnelAnalytics(deals, stages), [deals, stages]);

  const { data: insightRows = [], isLoading: loadingInsights } = useInsights({
    // A análise detalhada sempre representa um funil. Quando o filtro global
    // está em "todas", a mídia precisa seguir a conta vinculada a esse funil
    // para não misturar investimento de clientes diferentes.
    adAccountId: effectiveAdAccountId,
    startDate,
    endDate,
    enabled: visibleAccounts.length > 0,
  });

  const scopedInsights = useMemo(() => {
    if (selectedCampaign === "all") return insightRows;
    const campaign = selectedCampaign.trim().toLocaleLowerCase("pt-BR");
    const matches = insightRows.filter((row) => {
      const metaName = row.campaign_name.trim().toLocaleLowerCase("pt-BR");
      return metaName === campaign || metaName.includes(campaign) || campaign.includes(metaName);
    });
    // UTMs nem sempre repetem o nome da campanha da Meta. Não zeramos a mídia
    // silenciosamente quando não existe correspondência segura.
    return matches.length > 0 ? matches : insightRows;
  }, [insightRows, selectedCampaign]);

  const mediaMetrics = useMemo(
    () => computeFunnelMediaMetrics(scopedInsights, analytics.totalLeads, analytics.conversions, analytics.revenue),
    [scopedInsights, analytics.totalLeads, analytics.conversions, analytics.revenue],
  );

  async function handleSync() {
    if (!funnelId && visibleAccounts.length === 0) return;
    setSyncing(true);
    try {
      const start = format(startDate, "yyyy-MM-dd");
      const end = format(endDate, "yyyy-MM-dd");
      const funnelsToSync = activeFunnels.filter((funnel) => funnel.id === funnelId);

      const [metaResult, ...rdResults] = await Promise.allSettled([
        syncMeta.mutateAsync({
          adAccountId: effectiveAdAccountId,
          startDate: start,
          endDate: end,
        }),
        ...funnelsToSync.map(async (funnel) => {
          const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
            body: {
              funnel_id: funnel.id,
              analytics_mode: true,
              start_date: start,
              end_date: end,
              max_deals: 1200,
            },
          });
          if (error) {
            const details = await edgeFunctionErrorDetails(error);
            throw new Error(formatEdgeFunctionError(details));
          }
          if (data?.error) throw new Error(data.error);
          return data;
        }),
      ]);

      const rdFailures = rdResults.filter((result) => result.status === "rejected");
      if (metaResult.status === "rejected" && rdFailures.length === rdResults.length) {
        throw metaResult.reason;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["insights"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_deals"] }),
        queryClient.invalidateQueries({ queryKey: ["rd_funnel_stages"] }),
      ]);
      await refetch();

      if (metaResult.status === "rejected" || rdFailures.length > 0) {
        const metaMessage = metaResult.status === "rejected"
          ? (metaResult.reason instanceof Error ? metaResult.reason.message : String(metaResult.reason))
          : "";
        const rdMessage = rdFailures
          .map((result) => result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : "")
          .filter(Boolean)
          .join(" · ");
        toast.warning("Sincronização parcial", {
          description: [metaMessage && `Meta: ${metaMessage}`, rdMessage && `RD: ${rdMessage}`].filter(Boolean).join(" · "),
        });
      } else {
        toast.success(`Meta Ads e ${funnelsToSync.length} funil(is) do RD atualizados.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const noStages = !loadingStages && stages.length === 0;

  return (
    <MotionPage className="mx-auto max-w-[1700px] space-y-5">
      <MotionItem>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Análise de Funis</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe a performance completa dos seus leads e funis de conversão com base nos estágios reais do RD.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HealthBadge />
            <Button onClick={handleSync} disabled={syncing || syncMeta.isPending || (!funnelId && visibleAccounts.length === 0)} variant="default" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing || syncMeta.isPending ? "animate-spin" : ""}`} />
              Sincronizar Meta + RD
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        {loadingInsights ? (
          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Carregando métricas da Meta…</div>
        ) : (
          <HelpBlock help={blockHelp.media}><FunnelMediaOverview metrics={mediaMetrics} /></HelpBlock>
        )}
      </MotionItem>

      <MotionItem>
        <div className="gd-filter-strip gd-funnel-filter-strip rounded-xl border border-border bg-card p-3 shadow-sm">
          <Select value={adAccountId} onValueChange={setAdAccountId}>
            <SelectTrigger className="gd-filter-control gd-filter-account w-full bg-background/60 sm:w-[230px]">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Conta de anúncio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {visibleAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <MetaDateRangePicker
            preset={preset}
            onPresetChange={setPreset}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            startDate={startDate}
            endDate={endDate}
            className="gd-filter-control gd-filter-date"
          />

          <FilterSelect label="Origem" value={selectedSource} onChange={setSelectedSource} options={sources} />
          <FilterSelect label="Campanha" value={selectedCampaign} onChange={setSelectedCampaign} options={campaigns} />
          <FilterSelect label="Estado" value={selectedState} onChange={setSelectedState} options={states} />
          <FilterSelect label="Responsável" value={selectedOwner} onChange={setSelectedOwner} options={owners} />
          <FilterSelect label="Produto" value={selectedProduct} onChange={setSelectedProduct} options={products} />
        </div>
      </MotionItem>

      {activeFunnels.length === 0 ? (
        <MotionItem>
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum funil RD vinculado. Configure em <strong>Configurações → Funis RD</strong>.
            </p>
          </div>
        </MotionItem>
      ) : loadingFunnels || isLoading || loadingStages ? (
        <MotionItem>
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        </MotionItem>
      ) : noStages ? (
        <MotionItem>
          <div className="rounded-xl border bg-card p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Estágios reais do funil ainda não sincronizados. Clique em <strong>Sincronizar do RD</strong> para carregar.
            </p>
            <Button onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar agora
            </Button>
          </div>
        </MotionItem>
      ) : deals.length === 0 ? (
        <MotionItem>
          <div className="rounded-xl border bg-card p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Ainda não há deals sincronizados para este funil no período selecionado.
            </p>
            <Button onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar agora
            </Button>
          </div>
        </MotionItem>
      ) : (
        <>
          <MotionItem><FunnelKPIs a={analytics} cpl={mediaMetrics.rdCpl} cac={mediaMetrics.cac} /></MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HelpBlock help={blockHelp.distribution}><FunnelStageDistribution a={analytics} /></HelpBlock>
              <HelpBlock help={blockHelp.conversion}><FunnelStageConversion a={analytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <HelpBlock help={blockHelp.evolution}><FunnelLeadsEvolution a={analytics} /></HelpBlock>
              </div>
              <HelpBlock help={blockHelp.bottlenecks}><FunnelBottlenecks a={analytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <HelpBlock help={blockHelp.sources}><FunnelSourceTable a={analytics} /></HelpBlock>
              <HelpBlock help={blockHelp.losses}><FunnelLostReasons a={analytics} /></HelpBlock>
              <HelpBlock help={blockHelp.insights}><FunnelAutoInsights a={analytics} /></HelpBlock>
            </div>
          </MotionItem>

          <MotionItem>
            <HelpBlock help={blockHelp.states}><FunnelStateMap a={analytics} /></HelpBlock>
          </MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HelpBlock help={blockHelp.weekdays}><FunnelWeekdayChart a={analytics} /></HelpBlock>
              <HelpBlock help={blockHelp.hours}><FunnelHourChart a={analytics} /></HelpBlock>
            </div>
          </MotionItem>
        </>
      )}
    </MotionPage>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="gd-filter-control w-full bg-background/60 sm:w-[160px]">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos · {label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function HealthBadge() {
  const navigate = useNavigate();
  const { data, isLoading } = useRDHealthCheck();
  if (isLoading || !data) return null;
  const map = {
    ok: { Icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", label: "Integração OK" },
    warning: { Icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Atenção" },
    error: { Icon: XCircle, cls: "bg-red-500/10 text-red-600 border-red-500/30", label: "Reconectar" },
  } as const;
  const { Icon, cls, label } = map[data.overall];
  return (
    <Badge
      variant="outline"
      className={`${cls} cursor-pointer gap-1.5 px-2.5 py-1`}
      onClick={() => navigate("/configuracoes#rd-health")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
