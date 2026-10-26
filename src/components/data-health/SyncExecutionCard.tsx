import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const labels: Record<string, string> = {
  success: "Sucesso",
  partial: "Parcial",
  stale: "Snapshot anterior",
  failed: "Falhou",
  blocked: "Bloqueada",
  running: "Em andamento",
};

function statusClass(status: string) {
  if (status === "success") return "text-emerald-500";
  if (status === "partial" || status === "stale") return "text-amber-500";
  if (status === "running") return "text-sky-500";
  return "text-destructive";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "partial" || status === "stale") return <AlertTriangle className="h-4 w-4" />;
  if (status === "running") return <Clock3 className="h-4 w-4" />;
  if (status === "blocked") return <ShieldAlert className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}

export function SyncExecutionCard() {
  const query = useQuery({
    queryKey: ["sync-execution-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_execution_runs")
        .select("id,provider,status,started_at,finished_at,error_code,error_message,records_upserted,scope_key")
        .order("started_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data || []) as Array<Record<string, unknown>>;
    },
    staleTime: 30_000,
  });

  const runs = query.data || [];
  const latest = runs[0];
  const terminal = runs.filter((run) => ["failed", "blocked"].includes(String(run.status))).length;
  const denominator = runs.filter((run) => String(run.status) !== "running").length;
  const failureRate = denominator ? Math.round((terminal / denominator) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Execuções de sincronização</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Meta ↔ RD · correlação por sync_run_id</p>
        </div>
        {denominator > 0 && <Badge variant={failureRate > 1 ? "destructive" : "outline"}>{failureRate}% falhas recentes</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando auditoria…</p> : query.error ? <p className="text-sm text-destructive">Auditoria de sincronização indisponível: {(query.error as Error).message}</p> : !latest ? <p className="text-sm text-muted-foreground">Nenhuma execução auditada neste escopo.</p> : <>
          <div className={cn("flex items-center gap-2 text-sm font-semibold", statusClass(String(latest.status)))}>
            <StatusIcon status={String(latest.status)} />
            <span>{labels[String(latest.status)] || String(latest.status)}</span>
            <span className="text-xs font-normal text-muted-foreground">{String(latest.provider)} · {formatDistanceToNow(new Date(String(latest.started_at)), { addSuffix: true, locale: ptBR })}</span>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <span>Registros: {Number(latest.records_upserted || 0).toLocaleString("pt-BR")}</span>
            <span>Erro: {String(latest.error_code || "nenhum")}</span>
            <span className="truncate" title={String(latest.id)}>ID: {String(latest.id).slice(0, 8)}…</span>
          </div>
          {latest.error_message && <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{String(latest.error_message)}</p>}
          <div className="space-y-1 border-t border-border/50 pt-2">
            {runs.slice(0, 5).map((run) => <div key={String(run.id)} className="flex items-center justify-between gap-3 text-xs"><span className={cn("flex items-center gap-1.5", statusClass(String(run.status)))}><StatusIcon status={String(run.status)} />{labels[String(run.status)] || String(run.status)}</span><span className="truncate text-muted-foreground">{String(run.provider)} · {new Date(String(run.started_at)).toLocaleString("pt-BR")}</span></div>)}
          </div>
        </>}
      </CardContent>
    </Card>
  );
}
