import { useQuery } from "@tanstack/react-query";
import { CircleAlert, History, WalletCards } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { isPaidOperationStatus } from "@/lib/expertOperations";

const brl = (cents: number | null | undefined) => cents == null ? "Indisponível" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Props = { open: boolean; onOpenChange: (open: boolean) => void; eventClass: any; sales: any[]; sources: any[]; expertId: string };

export function ExpertClassDetailsDialog({ open, onOpenChange, eventClass, sales, sources, expertId }: Props) {
  const history = useQuery({
    queryKey: ["expert-class-history", eventClass.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("event_class_history").select("id,action,description,created_at").eq("event_class_id", eventClass.id).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data || [];
    },
  });
  const sheetStatus = useQuery({
    queryKey: ["expert-class-sheet-status", expertId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expert_sheet_connections").select("id,participant_type,status,last_sync_at,last_error").eq("expert_id", expertId);
      if (error) throw error;
      const ids = (data || []).map((row: any) => row.id);
      if (!ids.length) return { connections: data || [], runs: [] };
      const { data: runs, error: runsError } = await (supabase as any).from("expert_sales_sync_runs").select("id,sheet_connection_id,status,rows_read,rows_upserted,errors,started_at,finished_at").in("sheet_connection_id", ids).order("started_at", { ascending: false }).limit(10);
      if (runsError) throw runsError;
      return { connections: data || [], runs: runs || [] };
    },
  });
  const rows = sales.filter((row) => isPaidOperationStatus(row.status) && (row.event_class_id ? row.event_class_id === eventClass.id : (row.class_match_status !== "ambiguous" && row.class_name && String(row.class_name).toLocaleLowerCase() === String(eventClass.title).toLocaleLowerCase())));
  const students = rows.filter((row) => row.participant_type === "student");
  const patients = rows.filter((row) => row.participant_type === "model_patient");
  const gross = rows.reduce((sum, row) => sum + Number(row.gross_amount_cents || 0), 0);
  const cash = rows.reduce((sum, row) => sum + Number(row.cash_received_cents || 0), 0);
  const unmatched = sales.filter((row) => row.class_match_status && row.class_match_status !== "matched");

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{eventClass.title} — detalhes da turma</DialogTitle><p className="text-sm text-muted-foreground">{eventClass.date_start}{eventClass.date_end ? ` a ${eventClass.date_end}` : ""}{eventClass.location ? ` · ${eventClass.location}` : ""} · expert {expertId}</p></DialogHeader>
    <Tabs defaultValue="students"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5"><TabsTrigger value="students">Alunas ({students.length})</TabsTrigger><TabsTrigger value="patients">Pacientes ({patients.length})</TabsTrigger><TabsTrigger value="finance">Financeiro</TabsTrigger><TabsTrigger value="sync">Sincronização</TabsTrigger><TabsTrigger value="history">Histórico</TabsTrigger></TabsList>
      <TabsContent value="students" className="max-h-[52vh] space-y-2 overflow-y-auto">{students.length ? students.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span>{row.name}</span><span className="font-semibold text-emerald-500">{brl(row.cash_received_cents)}</span></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma aluna paga encontrada.</p>}</TabsContent>
      <TabsContent value="patients" className="max-h-[52vh] space-y-2 overflow-y-auto">{patients.length ? patients.map((row) => <div key={row.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span>{row.name}</span><span className="text-muted-foreground">{row.status}</span></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente-modelo encontrado.</p>}</TabsContent>
      <TabsContent value="finance" className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border p-4"><WalletCards className="h-4 w-4 text-emerald-500" /><p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Faturamento bruto</p><p className="mt-1 text-xl font-black">{brl(gross)}</p></div><div className="rounded-xl border border-border p-4"><WalletCards className="h-4 w-4 text-emerald-500" /><p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Caixa recebido</p><p className="mt-1 text-xl font-black text-emerald-500">{brl(cash)}</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo de vagas</p><p className="mt-1 text-xl font-black">{Math.max(0, Number(eventClass.max_students || 0) - students.length)} alunas</p></div></TabsContent>
      <TabsContent value="sync" className="max-h-[52vh] space-y-3 overflow-y-auto">{sources.length ? sources.map((source) => <div key={`${source.expert_id}-${source.ad_account_id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"><span>Meta: {source.ad_account_id || "não vinculada"}</span><Badge variant="outline">{source.attribution_window || "account_default"}</Badge></div>) : <p className="text-sm text-muted-foreground">Nenhuma conta Meta vinculada a este expert.</p>}{(sheetStatus.data?.connections || []).map((connection: any) => <div key={connection.id} className="rounded-lg border border-border p-3 text-sm"><div className="flex items-center justify-between"><span>Planilha: {connection.participant_type === "student" ? "Alunas" : "Pacientes-modelo"}</span><Badge variant={connection.status === "fresh" ? "default" : connection.status === "error" ? "destructive" : "outline"}>{connection.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Última sincronização: {connection.last_sync_at ? new Date(connection.last_sync_at).toLocaleString("pt-BR") : "Nunca"}</p>{connection.last_error && <p className="mt-1 text-xs text-destructive">{connection.last_error}</p>}</div>)}{(sheetStatus.data?.runs || []).map((run: any) => <div key={run.id} className="rounded-lg border border-border/60 p-3 text-xs"><div className="flex items-center justify-between"><span>{run.rows_upserted}/{run.rows_read} linhas importadas · {run.started_at ? new Date(run.started_at).toLocaleString("pt-BR") : ""}</span><Badge variant={run.status === "success" ? "default" : run.status === "error" ? "destructive" : "outline"}>{run.status}</Badge></div>{Array.isArray(run.errors) && run.errors.length > 0 && <ul className="mt-2 list-inside list-disc space-y-1 text-amber-700 dark:text-amber-300">{run.errors.slice(0, 10).map((error: string, index: number) => <li key={`${run.id}-${index}`}>{error}</li>)}</ul>}</div>)}{unmatched.length > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300"><CircleAlert className="mr-1 inline h-4 w-4" />{unmatched.length} venda(s) possuem turma não resolvida ou ambígua.</div>}</TabsContent>
      <TabsContent value="history" className="max-h-[52vh] space-y-2 overflow-y-auto">{history.isLoading && <p className="text-sm text-muted-foreground">Carregando histórico…</p>}{(history.data || []).map((item: any) => <div key={item.id} className="flex gap-3 rounded-lg border border-border p-3 text-sm"><History className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="font-semibold">{item.action}</p><p className="text-xs text-muted-foreground">{item.description || "Sem descrição"} · {new Date(item.created_at).toLocaleString("pt-BR")}</p></div></div>)}{!history.isLoading && !(history.data || []).length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento registrado.</p>}</TabsContent>
    </Tabs></DialogContent></Dialog>;
}
