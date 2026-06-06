import { useEffect, useMemo, useState } from "react";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDDeals, useFunnelStages, computeFunnelAnalytics } from "@/hooks/useRDDeals";
import { useDateFilter } from "@/hooks/useDateFilter";
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
import { RevenueDiagnosticsSection } from "@/components/funnel-analysis/RevenueDiagnosticsSection";
import { RefreshCw, Filter, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRDHealthCheck } from "@/hooks/useRDHealthCheck";
import { normalizeSelectedAdAccount, useSelectedAdAccountFilter } from "@/hooks/useSelectedAdAccountFilter";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/realtime";
import { toast } from "sonner";

export default function FunnelAnalysis() {
  const selectedAccount = useSelectedAdAccountFilter();
  const activeAccountId = normalizeSelectedAdAccount(selectedAccount);
  const { data: adAccounts = [] } = useAdAccounts({ refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const { data: funnels = [], isLoading: loadingFunnels } = useRDFunnels(activeAccountId, { refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS });
  const [selectedFunnel, setSelectedFunnel] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [selectedOwner, setSelectedOwner] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);

  const activeFunnels = funnels.filter((f) => f.is_active && f.rd_funnel_id);
  const funnelId = selectedFunnel || activeFunnels[0]?.id || "";
  const currentFunnel = activeFunnels.find((f) => f.id === funnelId);

  const { preset, setPreset, customRange, setCustomRange, startDate, endDate } = useDateFilter();

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
    refetchIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  });

  // Para popular filtros, precisamos do superset (sem filtro). Usamos os deals atuais como aproximação.
  const sources = useMemo(() => Array.from(new Set(deals.map((d) => d.utm_source).filter(Boolean) as string[])).sort(), [deals]);
  const campaigns = useMemo(() => Array.from(new Set(deals.map((d) => d.utm_campaign).filter(Boolean) as string[])).sort(), [deals]);
  const states = useMemo(() => Array.from(new Set(deals.map((d) => d.lead_state).filter(Boolean) as string[])).sort(), [deals]);
  const owners = useMemo(() => Array.from(new Set(deals.map((d) => d.deal_owner_name).filter(Boolean) as string[])).sort(), [deals]);
  const products = useMemo(() => Array.from(new Set(deals.map((d) => d.rd_product_name).filter(Boolean) as string[])).sort(), [deals]);

  const analytics = useMemo(() => computeFunnelAnalytics(deals, stages), [deals, stages]);

  useEffect(() => {
    if (!selectedFunnel) return;
    if (!activeFunnels.some((funnel) => funnel.id === selectedFunnel)) setSelectedFunnel("");
  }, [activeFunnels, selectedFunnel]);

  async function handleSync() {
    if (!funnelId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
        body: { funnel_id: funnelId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Sincronizado: ${data?.deals ?? 0} deals do RD.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const noStages = !loadingStages && stages.length === 0;

  return (
    <MotionPage className="space-y-6">
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
            <Button onClick={handleSync} disabled={syncing || !funnelId} variant="default" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sincronizar do RD
            </Button>
          </div>
        </div>
      </MotionItem>

      <MotionItem>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-card/40 p-3">
          <Select value={funnelId} onValueChange={setSelectedFunnel} disabled={loadingFunnels || activeFunnels.length === 0}>
            <SelectTrigger className="w-[240px] bg-background/60">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              {activeFunnels.map((f) => {
                const acc = adAccounts.find((a) => a.id === f.ad_account_id);
                return (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}{acc ? ` · ${acc.name}` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <MetaDateRangePicker
            preset={preset}
            onPresetChange={setPreset}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            startDate={startDate}
            endDate={endDate}
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
              Nenhum funil RD vinculado para a conta selecionada. Configure em <strong>Integrações → RD Station</strong>.
            </p>
          </div>
        </MotionItem>
      ) : isLoading || loadingStages ? (
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
          <MotionItem><FunnelKPIs a={analytics} /></MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FunnelStageDistribution a={analytics} />
              <FunnelStageConversion a={analytics} />
            </div>
          </MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <FunnelLeadsEvolution a={analytics} />
              </div>
              <FunnelBottlenecks a={analytics} />
            </div>
          </MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <FunnelSourceTable a={analytics} />
              <FunnelLostReasons a={analytics} />
              <FunnelAutoInsights a={analytics} />
            </div>
          </MotionItem>

          <MotionItem>
            <FunnelStateMap a={analytics} />
          </MotionItem>

          <MotionItem>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FunnelWeekdayChart a={analytics} />
              <FunnelHourChart a={analytics} />
            </div>
          </MotionItem>

        </>
      )}

      {activeFunnels.length > 0 && (
        <MotionItem>
          <RevenueDiagnosticsSection
            startDate={startDate}
            endDate={endDate}
            adAccountId={currentFunnel?.ad_account_id || undefined}
          />
        </MotionItem>
      )}
    </MotionPage>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px] bg-background/60">
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
      onClick={() => navigate("/settings#rd-health")}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}
