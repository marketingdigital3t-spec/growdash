import { useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, Database, RefreshCw, Server } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classifyWatermark, mergeHealthStatuses, percentile, type PlatformHealthStatus } from "@/lib/platformHealth";

type EventRow = { route: string; metric_name: string; duration_ms: number; created_at: string };
type ScopeRow = { status: string | null; last_success_at?: string | null; last_valid_snapshot_at?: string | null; updated_at?: string | null; last_error?: string | null };

const statusLabel: Record<PlatformHealthStatus, string> = {
  fresh: "Atualizado",
  stale: "Atrasado",
  degraded: "Degradado",
  no_data: "Sem evidência",
};

function statusVariant(status: PlatformHealthStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "fresh") return "default";
  if (status === "degraded") return "destructive";
  if (status === "stale") return "secondary";
  return "outline";
}

function latestScope(rows: ScopeRow[], successKey: "last_success_at" | "last_valid_snapshot_at") {
  return rows
    .map((row) => ({ row, timestamp: row[successKey] || row.last_success_at || null }))
    .sort((a, b) => new Date(b.row.updated_at || b.timestamp || 0).getTime() - new Date(a.row.updated_at || a.timestamp || 0).getTime())[0] || null;
}

export function PlatformPerformanceCard({ workspaceId }: { workspaceId?: string }) {
  const query = useQuery({
    queryKey: ["platform-performance", workspaceId],
    queryFn: async () => {
      const db = supabase as any;
      let eventsRequest = db.from("platform_performance_events").select("route,metric_name,duration_ms,created_at").order("created_at", { ascending: false }).limit(500);
      if (workspaceId) eventsRequest = eventsRequest.eq("workspace_id", workspaceId);
      const eventsResult = await eventsRequest;
      const events = (eventsResult.error ? [] : eventsResult.data || []) as EventRow[];

      const metaResult = await db.from("meta_sync_scope_state").select("status,last_success_at,last_valid_snapshot_at,updated_at,last_error").limit(200);
      const rdResult = await db.from("rd_sync_scope_state").select("status,last_success_at,updated_at,last_error").limit(200);
      return {
        events,
        meta: (metaResult.error ? [] : metaResult.data || []) as ScopeRow[],
        rd: (rdResult.error ? [] : rdResult.data || []) as ScopeRow[],
        telemetryUnavailable: !!eventsResult.error && /does not exist|schema cache|relation/i.test(eventsResult.error.message || ""),
      };
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const data = query.data;
  const routeP95 = useMemo(() => percentile((data?.events || []).filter((event) => event.metric_name === "route_commit").map((event) => Number(event.duration_ms)), 0.95), [data?.events]);
  const apiP95 = useMemo(() => percentile((data?.events || []).filter((event) => event.metric_name === "api_batch").map((event) => Number(event.duration_ms)), 0.95), [data?.events]);
  const metaLatest = latestScope(data?.meta || [], "last_valid_snapshot_at");
  const rdLatest = latestScope(data?.rd || [], "last_success_at");
  const metaStatus = metaLatest ? classifyWatermark(metaLatest.timestamp, metaLatest.row.last_error ? "error" : metaLatest.row.status) : "no_data";
  const rdStatus = rdLatest ? classifyWatermark(rdLatest.timestamp, rdLatest.row.last_error ? "error" : rdLatest.row.status) : "no_data";
  const overall = mergeHealthStatuses([metaStatus, rdStatus]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Activity className="h-4 w-4" /></span>
          <div><CardTitle className="text-base">Performance e confiabilidade</CardTitle><p className="mt-1 text-xs text-muted-foreground">Telemetria sem payloads e watermarks oficiais de Meta/RD.</p></div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "mr-2 h-3.5 w-3.5 animate-spin" : "mr-2 h-3.5 w-3.5"} />Atualizar</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Clock3 className="h-3.5 w-3.5" />} label="P95 render rota" value={routeP95 == null ? "—" : `${Math.round(routeP95)} ms`} />
          <Metric icon={<Server className="h-3.5 w-3.5" />} label="P95 API Supabase" value={apiP95 == null ? "—" : `${Math.round(apiP95)} ms`} />
          <Metric icon={<Activity className="h-3.5 w-3.5" />} label="Amostras recentes" value={String(data?.events.length || 0)} />
          <Metric icon={<Database className="h-3.5 w-3.5" />} label="Estado geral" value={statusLabel[overall]} />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <SourceStatus label="Meta Ads" status={metaStatus} timestamp={metaLatest?.timestamp} />
          <SourceStatus label="RD Station" status={rdStatus} timestamp={rdLatest?.timestamp} />
        </div>
        {data?.telemetryUnavailable && <p className="text-xs text-amber-600">A tabela de telemetria ainda não está publicada neste ambiente. Os watermarks continuam sendo consultados.</p>}
        <p className="text-[11px] text-muted-foreground">Atualizado a cada 30 s. “Atualizado” representa o último snapshot oficial confirmado, não streaming instantâneo do provedor.</p>
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-border/70 bg-muted/20 p-3"><div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{label}</div><strong className="mt-1 block text-lg tabular-nums">{value}</strong></div>;
}

function SourceStatus({ label, status, timestamp }: { label: string; status: PlatformHealthStatus; timestamp?: string | null }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3"><div><span className="text-xs font-bold">{label}</span><p className="mt-0.5 text-[11px] text-muted-foreground">{timestamp ? `último sucesso ${formatDistanceToNow(new Date(timestamp), { locale: ptBR, addSuffix: true })}` : "nenhum watermark confirmado"}</p></div><Badge variant={statusVariant(status)}>{statusLabel[status]}</Badge></div>;
}
