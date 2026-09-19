import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function SyncAuditCard() {
  const [running, setRunning] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["sync-audit"],
    queryFn: async () => {
      const client = supabase as any;
      const { data: runs, error } = await client.from("sync_backfill_runs").select("id,status,started_at,finished_at,summary,error_message").order("started_at", { ascending: false }).limit(1);
      if (error) throw error;
      const run = runs?.[0];
      if (!run) return { run: null, items: [] };
      const { data: items } = await client.from("sync_backfill_items").select("provider,status,account_id,funnel_id,window_start,window_end,pages_read,records_upserted,gaps,error_message").eq("run_id", run.id).order("started_at", { ascending: true }).limit(200);
      return { run, items: items || [] };
    },
    refetchInterval: 15000,
  });

  const start = async () => {
    setRunning(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("historical-backfill", { body: {} });
      if (error) throw error;
      toast({ title: "Backfill histórico iniciado", description: `Execução ${(result as any)?.run_id || "criada"}. O painel será atualizado automaticamente.` });
      refetch();
    } catch (error) {
      toast({ title: "Falha no backfill histórico", description: (error as Error).message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const run = data?.run;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><div><CardTitle className="text-base">Backfill e auditoria Meta ↔ RD</CardTitle><p className="mt-0.5 text-xs text-muted-foreground">Histórico disponível, lacunas e última execução incremental</p></div></div>
        <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Atualizar</Button><Button size="sm" onClick={start} disabled={running}>{running ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <History className="mr-2 h-3.5 w-3.5" />}Sincronizar histórico</Button></div>
      </CardHeader>
      <CardContent className="space-y-3">
        {run ? <><div className="flex flex-wrap items-center gap-2 text-xs"><Badge variant={run.status === "success" ? "default" : run.status === "running" ? "outline" : "destructive"}>{run.status}</Badge><span className="text-muted-foreground">Início: {new Date(run.started_at).toLocaleString("pt-BR")}</span><span className="text-muted-foreground">Itens: {run.summary?.items ?? data?.items.length ?? 0}</span><span className="text-muted-foreground">Falhas: {run.summary?.failures ?? 0}</span></div>{run.error_message && <p className="text-xs text-red-500">{run.error_message}</p>}<div className="space-y-1">{(data?.items || []).slice(-8).map((item: any, index: number) => <div key={`${item.provider}-${item.account_id || item.funnel_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/50 px-3 py-2 text-xs"><div className="flex items-center gap-2"><Badge variant="outline">{item.provider}</Badge><Badge variant={item.status === "success" ? "default" : "destructive"}>{item.status}</Badge><span>{item.window_start} → {item.window_end}</span></div><span className="tabular-nums text-muted-foreground">{item.pages_read} páginas · {item.records_upserted} registros</span></div>)}</div></> : <p className="text-sm text-muted-foreground">Nenhum backfill histórico registrado ainda.</p>}
      </CardContent>
    </Card>
  );
}
