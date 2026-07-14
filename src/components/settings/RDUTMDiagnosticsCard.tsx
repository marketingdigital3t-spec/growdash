import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useRDUTMDiagnostics, type DiagSeverity } from "@/hooks/useRDUTMDiagnostics";
import { Stethoscope, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, ChevronDown, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function severityMeta(s: DiagSeverity) {
  if (s === "critical")
    return { Icon: AlertCircle, cls: "text-red-500", badge: "bg-red-500/10 text-red-600 border-red-500/30", label: "Crítico" };
  if (s === "warning")
    return { Icon: AlertTriangle, cls: "text-amber-500", badge: "bg-amber-500/10 text-amber-600 border-amber-500/30", label: "Atenção" };
  return { Icon: Info, cls: "text-blue-500", badge: "bg-blue-500/10 text-blue-600 border-blue-500/30", label: "Info" };
}

export function RDUTMDiagnosticsCard() {
  const { data, isLoading, isFetching, refetch } = useRDUTMDiagnostics();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const issuesCount = data?.issues.length ?? 0;
  const criticalCount = data?.issues.filter((i) => i.severity === "critical").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" /> Diagnóstico de UTMs
          </span>
          {data && (
            <Badge
              variant="outline"
              className={
                issuesCount === 0
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : criticalCount > 0
                    ? "bg-red-500/10 text-red-600 border-red-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
              }
            >
              {issuesCount === 0 ? "Tudo OK" : `${issuesCount} problema${issuesCount > 1 ? "s" : ""}`}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Detecta automaticamente por que vendas do RD não estão batendo com campanhas do Meta — UTMs ausentes, formatação diferente, etapas órfãs e funis inativos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {data?.checkedAt
              ? `${data.totalDealsAnalyzed} deals analisados • ${formatDistanceToNow(parseISO(data.checkedAt), { locale: ptBR, addSuffix: true })}`
              : "Aguardando primeira análise…"}
          </p>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Re-analisar
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Analisando deals…</p>
        ) : !data ? null : data.issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Nenhum problema de atribuição detectado. UTMs estão limpas.</span>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {data.issues.map((issue) => {
                const meta = severityMeta(issue.severity);
                const isOpen = expanded.has(issue.id);
                return (
                  <motion.div
                    key={issue.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-md border border-border/60 bg-muted/30"
                  >
                    <Collapsible open={isOpen} onOpenChange={() => toggle(issue.id)}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-md">
                          <meta.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${meta.cls}`} />
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{issue.title}</p>
                              <Badge variant="outline" className={`${meta.badge} text-[10px] px-1.5 py-0`}>
                                {meta.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {issue.affectedCount} afetado{issue.affectedCount > 1 ? "s" : ""}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{issue.description}</p>
                          </div>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 mt-0.5 ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-1 space-y-1 border-t border-border/60">
                          {issue.samples.length === 0 ? (
                            <p className="text-xs text-muted-foreground pt-2">Sem amostras.</p>
                          ) : (
                            <>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-2">
                                Amostras
                              </p>
                              {issue.samples.map((s, i) => (
                                <div
                                  key={`${s.rd_deal_id}-${i}`}
                                  className="flex items-start justify-between gap-3 text-xs rounded bg-background/60 px-2 py-1.5"
                                >
                                  <span className="font-medium truncate">{s.label}</span>
                                  {s.extra && (
                                    <span className="text-muted-foreground text-right truncate max-w-[60%]">
                                      {s.extra}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
