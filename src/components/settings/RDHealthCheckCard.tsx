import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRDHealthCheck, type CheckStatus } from "@/hooks/useRDHealthCheck";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function statusIcon(s: CheckStatus, className = "h-4 w-4") {
  if (s === "ok") return <CheckCircle2 className={`${className} text-emerald-500`} />;
  if (s === "warning") return <AlertTriangle className={`${className} text-amber-500`} />;
  return <XCircle className={`${className} text-red-500`} />;
}

function overallBadge(s: CheckStatus) {
  if (s === "ok") return { label: "Tudo OK", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  if (s === "warning") return { label: "Atenção", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
  return { label: "Reconectar", cls: "bg-red-500/10 text-red-600 border-red-500/30" };
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RDHealthCheckCard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isFetching, refetch } = useRDHealthCheck();

  const syncFunnel = useMutation({
    mutationFn: async (funnelId?: string) => {
      const { data, error } = await supabase.functions.invoke("rd-sync-deals", {
        body: funnelId ? { funnel_id: funnelId } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Sincronizado com sucesso.");
      qc.invalidateQueries({ queryKey: ["rd_health_check"] });
      qc.invalidateQueries({ queryKey: ["rd_deals"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao sincronizar"),
  });

  const summary = useMemo(() => (data ? overallBadge(data.overall) : null), [data]);

  function handleAction(kind: string, funnelId?: string) {
    if (kind === "sync-funnel" || kind === "sync-deals") {
      syncFunnel.mutate(funnelId);
      return;
    }
    if (kind === "reconnect-token" || kind === "link-funnel") {
      const el = document.getElementById(kind === "reconnect-token" ? "rd-integration" : "rd-funnels");
      el?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (kind === "review-utm") {
      navigate("/campaigns");
    }
  }

  return (
    <Card id="rd-health">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Diagnóstico RD ↔ Campanhas
          </span>
          {summary && (
            <Badge variant="outline" className={summary.cls}>
              {summary.label}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Verifica se o RD Station está conectado, se as vendas chegam corretamente nas campanhas e se os números batem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <HowToSyncSteps
          steps={[
            { title: "Clique em 'Verificar agora'", detail: "Roda todos os checks: token RD, funis vinculados, deals dos últimos 30 dias e match com campanhas Meta." },
            { title: "Revise os itens com status laranja ou vermelho", detail: "Cada item mostra exatamente o que precisa ser corrigido." },
            { title: "Use o botão 'Sincronizar' do próprio item", detail: "Quando aparecer, ele puxa os dados faltantes daquele funil específico." },
            { title: "Confira o confronto de 30 dias", detail: "Compare Vendas RD vs. Vendas em Campanhas. Match abaixo de 80% indica problema de UTM — abra o Diagnóstico de UTMs." },
          ]}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {data?.checkedAt
              ? `Última verificação: ${formatDistanceToNow(parseISO(data.checkedAt), { locale: ptBR, addSuffix: true })}`
              : "Aguardando primeira verificação…"}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Verificar agora
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Executando checagens…</p>
        ) : !data ? null : (
          <>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {data.checks.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                  >
                    <div className="pt-0.5">{statusIcon(c.status)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.label}</p>
                      {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                    </div>
                    {c.action && c.status !== "ok" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={syncFunnel.isPending}
                        onClick={() => handleAction(c.action!.kind, c.action!.funnelId)}
                      >
                        {c.action.label}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {data.comparison.length > 0 && (
              <div className="rounded-md border bg-background p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confronto últimos 30 dias
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Vendas RD (win)</p>
                    <p className="font-semibold">{data.totals.rdWins}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vendas em Campanhas</p>
                    <p className="font-semibold">{data.totals.salesLinked}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Receita RD</p>
                    <p className="font-semibold">{brl(data.totals.revenueRD)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Receita atribuída</p>
                    <p className="font-semibold">{brl(data.totals.revenueSales)}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/60 space-y-1">
                  {data.comparison.map((c) => (
                    <div key={c.funnelId} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate mr-2">{c.funnelName}</span>
                      <span>
                        RD <strong className="text-foreground">{c.rdWins}</strong> · Vendas{" "}
                        <strong className="text-foreground">{c.salesLinked}</strong> · Match{" "}
                        <strong className="text-foreground">{Math.round(c.matchRate * 100)}%</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
