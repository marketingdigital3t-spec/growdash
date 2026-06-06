import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, PlayCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface JobRun {
  id: string;
  job_name: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  processed_count: number;
  error_message: string | null;
  trigger_source: string;
}

export function JobRunsCard() {
  const [running, setRunning] = useState(false);

  const { data: runs, refetch } = useQuery({
    queryKey: ["job-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(20);
      return (data || []) as JobRun[];
    },
    refetchInterval: 15000,
  });

  const runNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-reconciliation", { body: {} });
      if (error) throw error;
      toast({ title: "Reconciliação iniciada", description: "Resultados aparecerão abaixo em instantes." });
      setTimeout(() => refetch(), 2000);
    } catch (e) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const lastByJob = new Map<string, JobRun>();
  for (const r of runs || []) if (!lastByJob.has(r.job_name)) lastByJob.set(r.job_name, r);

  const jobs = [
    { key: "reconcile-sales-rd", label: "Reconciliação vendas ↔ RD" },
    { key: "rd-enrich-states", label: "Enriquecimento de estados" },
    { key: "meta-sync-retry", label: "Retry sync Meta" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Jobs automáticos</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Executado diariamente às 4h BRT</p>
        </div>
        <Button size="sm" onClick={runNow} disabled={running}>
          {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
          Executar agora
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {jobs.map((j) => {
            const last = lastByJob.get(j.key);
            const ok = last?.status === "success";
            const isStale = last && Date.now() - new Date(last.started_at).getTime() > 36 * 3600 * 1000;
            return (
              <div key={j.key} className="rounded-md border border-border/60 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {last ? (ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />) : <Clock className="h-4 w-4" />}
                  {j.label}
                </div>
                <div className="mt-1 text-sm font-semibold tabular-nums">
                  {last ? `${last.processed_count} processados` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {last ? formatDistanceToNow(parseISO(last.started_at), { locale: ptBR, addSuffix: true }) : "nunca"}
                  {isStale && <Badge variant="destructive" className="ml-2 text-[10px]">atrasado</Badge>}
                </div>
                {last?.error_message && (
                  <div className="mt-1 line-clamp-2 text-[11px] text-red-500">{last.error_message}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1 text-xs">
          <div className="font-medium text-muted-foreground">Histórico recente</div>
          {(runs || []).slice(0, 8).map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-0">
              <div className="flex items-center gap-2">
                {r.status === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : r.status === "error" ? (
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <span className="font-mono">{r.job_name}</span>
                <Badge variant="outline" className="text-[10px]">{r.trigger_source}</Badge>
              </div>
              <span className="tabular-nums text-muted-foreground">
                {format(parseISO(r.started_at), "dd/MM HH:mm", { locale: ptBR })} • {r.processed_count}
              </span>
            </div>
          ))}
          {(runs || []).length === 0 && (
            <div className="py-3 text-center text-muted-foreground">Nenhuma execução registrada ainda.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
