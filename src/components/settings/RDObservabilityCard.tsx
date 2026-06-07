import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRDObservability, type HealthLevel } from "@/hooks/useRDObservability";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  RefreshCw,
  Webhook,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import { HowToSyncSteps } from "./HowToSyncSteps";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function levelDot(l: HealthLevel) {
  if (l === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (l === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function levelBadge(l: HealthLevel) {
  if (l === "ok")
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">OK</Badge>;
  if (l === "warning")
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Atenção</Badge>;
  return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Crítico</Badge>;
}

function progressColor(pct: number, okMin = 0.8, warnMin = 0.5) {
  if (pct >= okMin) return "bg-emerald-500";
  if (pct >= warnMin) return "bg-amber-500";
  return "bg-red-500";
}

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export function RDObservabilityCard() {
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useRDObservability();
  const [expandRuns, setExpandRuns] = useState(false);

  const syncFunnel = useMutation({
    mutationFn: async (funnelId: string) => {
      const { data, error } = await supabase.functions.invoke("rd-sync-deals", { body: { funnel_id: funnelId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Sincronização iniciada.");
      qc.invalidateQueries({ queryKey: ["rd_observability"] });
      qc.invalidateQueries({ queryKey: ["rd_health_check"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sincronizar"),
  });

  const overall: HealthLevel = useMemo(() => {
    if (!data) return "ok";
    const all: HealthLevel[] = [
      ...data.funnels.map((f) => f.level),
      data.dataQuality.level,
      data.webhooks.level,
      data.attribution.level,
    ];
    if (all.includes("error")) return "error";
    if (all.includes("warning")) return "warning";
    return "ok";
  }, [data]);

  return (
    <Card id="rd-observability">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Observabilidade RD Station
          </span>
          {data && levelBadge(overall)}
        </CardTitle>
        <CardDescription>
          Saúde por funil, qualidade dos dados, webhooks recebidos e atribuição multi-touch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <HowToSyncSteps
          steps={[
            { title: "Clique em 'Atualizar' no topo", detail: "Recalcula a saúde de cada funil, qualidade dos dados e webhooks recebidos." },
            { title: "Funis com aviso laranja → clique em 'Sincronizar' na linha", detail: "Puxa os deals dos últimos 30 dias daquele funil específico." },
            { title: "Qualidade dos dados abaixo de 80% → revise as UTMs", detail: "Use o card 'Diagnóstico de UTMs' na aba UTMs para ver exatamente quais deals estão sem source/medium/campaign." },
            { title: "Atribuição multi-touch zerada → rode o Backfill", detail: "Vá no widget de Atribuição do dashboard e clique em Backfill para popular o histórico de toques." },
            { title: "Webhooks fora do esperado", detail: "Confira na aba RD CRM se o webhook está apontando para a URL correta e se os eventos deal_created e deal_updated estão marcados." },
          ]}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {data?.checkedAt
              ? `Última verificação: ${formatDistanceToNow(parseISO(data.checkedAt), { locale: ptBR, addSuffix: true })}`
              : "Aguardando…"}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando diagnóstico…</p>
        ) : (
          <>
            {/* Bloco 1 — Sincronização por funil */}
            <section className="space-y-2">
              <header className="flex items-center gap-2 text-sm font-semibold">
                <Workflow className="h-4 w-4 text-muted-foreground" />
                Sincronização por funil
              </header>
              {data.funnels.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum funil ativo cadastrado.</p>
              ) : (
                <div className="rounded-md border divide-y">
                  <AnimatePresence initial={false}>
                    {data.funnels.map((f) => (
                      <motion.div
                        key={f.funnel_id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <div>{levelDot(f.level)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{f.funnel_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.last_run_at
                              ? `Último sync ${formatDistanceToNow(parseISO(f.last_run_at), { locale: ptBR, addSuffix: true })}`
                              : "Nunca sincronizado"}
                            {f.last_status === "failed" && f.last_error ? ` · falhou: ${f.last_error.slice(0, 80)}` : ""}
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground whitespace-nowrap">
                          <span>24h <strong className="text-foreground">{fmtNum(f.deals_24h)}</strong></span>
                          <span>7d <strong className="text-foreground">{fmtNum(f.deals_7d)}</strong></span>
                          <span>30d <strong className="text-foreground">{fmtNum(f.deals_30d)}</strong></span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={syncFunnel.isPending}
                          onClick={() => syncFunnel.mutate(f.funnel_id)}
                        >
                          Sincronizar
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Bloco 2 — Qualidade dos dados */}
            <section className="space-y-3">
              <header className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4 text-muted-foreground" />
                Qualidade dos dados (30d) {levelBadge(data.dataQuality.level)}
              </header>
              <div className="space-y-2">
                <QualityRow
                  label="UTMs completos (source + medium + campaign)"
                  pct={data.dataQuality.utmCompletePct}
                />
                <QualityRow label="Deal com responsável preenchido" pct={data.dataQuality.ownerNamePct} />
                <QualityRow
                  label="Vendas ganhas com valor > 0"
                  pct={data.dataQuality.winsWithAmountPct}
                  okMin={0.95}
                  warnMin={0.7}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Base: {fmtNum(data.dataQuality.totalDeals30d)} deals nos últimos 30 dias.
              </p>
            </section>

            {/* Bloco 3 — Webhooks */}
            <section className="space-y-2">
              <header className="flex items-center gap-2 text-sm font-semibold">
                <Webhook className="h-4 w-4 text-muted-foreground" />
                Webhooks RD {levelBadge(data.webhooks.level)}
              </header>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Metric label="Últimas 24h" value={fmtNum(data.webhooks.events24h)} />
                <Metric label="Últimos 7d" value={fmtNum(data.webhooks.events7d)} />
                <Metric label="Média/dia (30d)" value={data.webhooks.avgPerDay30d.toFixed(1)} />
                <Metric
                  label="Volume vs média"
                  value={fmtPct(data.webhooks.ratioVsAvg)}
                  hint={
                    data.webhooks.ratioVsAvg < 0.5
                      ? "Abaixo do esperado"
                      : data.webhooks.ratioVsAvg > 1.5
                      ? "Acima do esperado"
                      : "Dentro do esperado"
                  }
                />
              </div>
              {data.webhooks.lastEventAt && (
                <p className="text-xs text-muted-foreground">
                  Último evento {formatDistanceToNow(parseISO(data.webhooks.lastEventAt), { locale: ptBR, addSuffix: true })}.
                </p>
              )}
            </section>

            {/* Bloco 4 — Atribuição */}
            <section className="space-y-3">
              <header className="flex items-center gap-2 text-sm font-semibold">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Atribuição multi-touch {levelBadge(data.attribution.level)}
              </header>
              <div className="space-y-2">
                <QualityRow label="Deals com ao menos 1 toque registrado" pct={data.attribution.withTouchesPct} />
                <QualityRow
                  label="Deals com múltiplos toques"
                  pct={data.attribution.multiTouchPct}
                  okMin={0.3}
                  warnMin={0.1}
                />
                <QualityRow
                  label="Toques casados com campanha Meta"
                  pct={data.attribution.matchedTouchesPct}
                  okMin={0.7}
                  warnMin={0.4}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Base: {fmtNum(data.attribution.totalDeals30d)} deals nos últimos 30 dias.
                {data.attribution.withTouchesPct < 0.6 && (
                  <> Considere rodar o <strong>Backfill</strong> no widget de Atribuição do dashboard.</>
                )}
              </p>
            </section>

            {/* Histórico de execuções */}
            <section className="space-y-2">
              <button
                onClick={() => setExpandRuns((v) => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold py-1"
              >
                <span>Últimas execuções de sincronização</span>
                {expandRuns ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <AnimatePresence initial={false}>
                {expandRuns && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-md border divide-y text-xs">
                      {data.recentRuns.length === 0 && (
                        <p className="px-3 py-2 text-muted-foreground">Sem execuções registradas.</p>
                      )}
                      {data.recentRuns.map((r) => (
                        <div key={r.id} className="px-3 py-2 flex items-center gap-3">
                          {levelDot(r.status === "failed" ? "error" : r.errors_total > 0 ? "warning" : "ok")}
                          <span className="flex-1 truncate">
                            {formatDistanceToNow(parseISO(r.started_at), { locale: ptBR, addSuffix: true })}
                            {r.error_message ? ` · ${r.error_message.slice(0, 80)}` : ""}
                          </span>
                          <span className="text-muted-foreground">
                            {r.deals_fetched} deals · {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function QualityRow({
  label,
  pct,
  okMin = 0.8,
  warnMin = 0.5,
}: {
  label: string;
  pct: number;
  okMin?: number;
  warnMin?: number;
}) {
  const color = progressColor(pct, okMin, warnMin);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{fmtPct(pct)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}
