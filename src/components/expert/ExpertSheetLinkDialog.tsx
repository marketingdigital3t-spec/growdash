import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; expertId: string; eventClass: any; onSaved?: () => void };

export function ExpertSheetLinkDialog({ open, onOpenChange, expertId, eventClass, onSaved }: Props) {
  const connections = useQuery({
    queryKey: ["expert-sheet-connections", expertId],
    enabled: open && Boolean(expertId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expert_sheet_connections").select("*").eq("expert_id", expertId);
      if (error) throw error;
      return data || [];
    },
  });
  const sources = useQuery({
    queryKey: ["expert-operation-sources", expertId],
    enabled: open && Boolean(expertId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expert_operation_sources").select("ad_account_id").eq("expert_id", expertId);
      if (error) throw error;
      return data || [];
    },
  });
  const accounts = useAdAccounts();
  const [accountId, setAccountId] = useState("");
  const [studentSheet, setStudentSheet] = useState("");
  const [patientSheet, setPatientSheet] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const rows = connections.data || [];
    setStudentSheet(rows.find((row: any) => row.participant_type === "student")?.spreadsheet_id || "");
    setPatientSheet(rows.find((row: any) => row.participant_type === "model_patient")?.spreadsheet_id || "");
    setAccountId(sources.data?.[0]?.ad_account_id || "");
  }, [connections.data, sources.data, open]);

  const save = async () => {
    if (!studentSheet.trim() && !patientSheet.trim()) {
      toast({ title: "Informe ao menos uma planilha.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const rows = [
        studentSheet.trim() ? { expert_id: expertId, participant_type: "student", spreadsheet_id: studentSheet.trim(), worksheet_name: "Alunas", status: "pending" } : null,
        patientSheet.trim() ? { expert_id: expertId, participant_type: "model_patient", spreadsheet_id: patientSheet.trim(), worksheet_name: "Pacientes_Modelo", status: "pending" } : null,
      ].filter(Boolean) as any[];
      if (accountId) {
        const { error } = await (supabase as any).from("expert_operation_sources").upsert({ expert_id: expertId, ad_account_id: accountId, timezone: "America/Sao_Paulo", attribution_window: "account_default" }, { onConflict: "expert_id,ad_account_id" });
        if (error) throw error;
      }
      for (const row of rows) {
        const { data, error } = await (supabase as any).from("expert_sheet_connections").upsert(row, { onConflict: "expert_id,participant_type" }).select("id").single();
        if (error) throw error;
        const result = await supabase.functions.invoke("google-sheets-sync", { body: { connection_id: data.id, source_class_id: eventClass.id } });
        if (result.error) throw result.error;
        if (result.data?.status === "partial") toast({ title: "Sincronização parcial", description: `${result.data.errors?.length || 0} divergência(s) precisam de revisão.` });
      }
      toast({ title: "Planilhas vinculadas", description: `A turma usa o identificador ${eventClass.id}.` });
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Não foi possível sincronizar", description: error?.message || "Revise a conexão Google e os nomes das abas.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" />Vincular planilhas — {eventClass.title}</DialogTitle><p className="text-sm text-muted-foreground">A conexão é compartilhada pelo expert; a turma é filtrada pelo identificador abaixo.</p></DialogHeader>
    <div className="space-y-4"><div className="rounded-lg border border-dashed border-primary/40 bg-primary/[.03] p-3 text-sm"><div className="font-semibold">Identificador preferencial da turma</div><code className="mt-1 block break-all text-xs text-muted-foreground">{eventClass.id}</code><p className="mt-2 text-xs text-muted-foreground">Use este valor na coluna <b>turma_id</b>. O nome da turma será usado apenas como fallback.</p></div>
      <div><Label>Conta Meta do expert</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue placeholder="Selecione a conta integrada" /></SelectTrigger><SelectContent>{(accounts.data || []).map((account: any) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-[11px] text-muted-foreground">O tráfego do calendário será puxado desta conta.</p></div><div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="expert-student-sheet">Planilha de alunas</Label><Input id="expert-student-sheet" value={studentSheet} onChange={(event) => setStudentSheet(event.target.value)} placeholder="ID da planilha Google" /><p className="mt-1 text-[11px] text-muted-foreground">Aba: Alunas</p></div><div><Label htmlFor="expert-patient-sheet">Planilha de pacientes-modelo</Label><Input id="expert-patient-sheet" value={patientSheet} onChange={(event) => setPatientSheet(event.target.value)} placeholder="ID da planilha Google" /><p className="mt-1 text-[11px] text-muted-foreground">Aba: Pacientes_Modelo</p></div></div>
      <div className="space-y-2">{(connections.data || []).map((row: any) => <div key={row.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"><span>{row.participant_type === "student" ? "Alunas" : "Pacientes-modelo"}</span><Badge variant={row.status === "fresh" ? "default" : row.status === "error" ? "destructive" : "outline"}>{row.status}</Badge></div>)}{connections.isLoading && <p className="text-xs text-muted-foreground">Carregando conexões…</p>}</div>
    </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button><Button onClick={() => void save()} disabled={saving || connections.isLoading}>{saving ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sincronizando…</> : "Salvar e sincronizar"}</Button></DialogFooter></DialogContent></Dialog>;
}
