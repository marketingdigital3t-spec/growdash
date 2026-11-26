import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, RefreshCw, Save, TestTube2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const FIELDS = [
  ["name", "Nome / aluna"], ["cpf", "CPF"], ["phone", "Telefone"], ["turma_id", "ID da turma"], ["class_name", "Nome da turma"],
  ["sale_date", "Data do pagamento"], ["class_date", "Data da turma"], ["gross_amount", "Valor da venda"], ["cash_received", "Valor pago / entrada"],
  ["future_revenue", "Faturamento futuro"], ["installment_number", "Parcela"], ["installment_condition", "Condição"], ["reconciliation_status", "Conciliação"],
  ["product", "Produto"], ["payment_method", "Forma de pagamento"], ["seller_name", "Vendedor"], ["contract_signed", "Contrato assinado"], ["notes", "Observações"],
] as const;

function sheetId(value: string) {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || value.trim();
}

export function GoogleSheetsSalesIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const experts = useQuery({ queryKey: ["integration-experts"], queryFn: async () => { const { data, error } = await (supabase as any).from("experts").select("id,nome").order("nome"); if (error) throw error; return data || []; } });
  const [expertId, setExpertId] = useState("");
  const connections = useQuery({ queryKey: ["expert-sheet-connections", expertId], enabled: Boolean(expertId), queryFn: async () => { const { data, error } = await (supabase as any).from("expert_sheet_connections").select("*").eq("expert_id", expertId); if (error) throw error; return data || []; } });
  const [sourceType, setSourceType] = useState<"sales" | "student" | "model_patient">("sales");
  const [spreadsheet, setSpreadsheet] = useState("");
  const [worksheet, setWorksheet] = useState("Vendas");
  const [interval, setInterval] = useState("15");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const current = useMemo(() => (connections.data || []).find((row: any) => row.source_type === sourceType || (sourceType === "student" && row.participant_type === "student" && !row.source_type)), [connections.data, sourceType]);
  useEffect(() => {
    setSpreadsheet(current?.spreadsheet_id || ""); setWorksheet(current?.worksheet_name || (sourceType === "sales" ? "Vendas" : sourceType === "student" ? "Alunas" : "Pacientes_Modelo")); setInterval(String(current?.sync_interval_minutes || 15)); setMapping(current?.column_mapping || {});
  }, [current, sourceType]);
  const save = async (sync = false) => {
    if (!expertId || !spreadsheet.trim() || !worksheet.trim()) { toast({ title: "Informe expert, planilha e aba.", variant: "destructive" }); return; }
    const participantType = sourceType === "model_patient" ? "model_patient" : "student";
    const { data, error } = await (supabase as any).from("expert_sheet_connections").upsert({ expert_id: expertId, participant_type: participantType, source_type: sourceType, spreadsheet_id: sheetId(spreadsheet), worksheet_name: worksheet.trim(), column_mapping: mapping, sync_interval_minutes: Math.max(5, Number(interval) || 15), enabled: true, status: "pending" }, { onConflict: "expert_id,source_type" }).select("id").single();
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return; }
    if (sync) { const result = await supabase.functions.invoke("google-sheets-sync", { body: { connection_id: data.id } }); if (result.error || result.data?.status === "error") { toast({ title: "Falha na sincronização", description: result.data?.error || result.error?.message, variant: "destructive" }); return; } toast({ title: "Planilha sincronizada", description: `${result.data?.rows_upserted || 0} linhas processadas.` }); }
    else toast({ title: "Configuração salva" });
    void queryClient.invalidateQueries({ queryKey: ["expert-sheet-connections", expertId] });
  };
  return <section className="gd-panel overflow-hidden"><div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><FileSpreadsheet className="h-5 w-5" /></span><div className="grow"><h2 className="font-black">Google Sheets — Vendas & Turmas</h2><p className="text-xs text-muted-foreground">Fonte somente leitura para alunas, turmas e financeiro. A planilha nunca é alterada pela Growdash.</p></div><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-600">Configurável</span></div><div className="space-y-4 p-5"><div className="grid gap-3 sm:grid-cols-3"><div><Label>Expert</Label><Select value={expertId} onValueChange={setExpertId}><SelectTrigger><SelectValue placeholder="Selecione o expert" /></SelectTrigger><SelectContent>{(experts.data || []).map((expert: any) => <SelectItem key={expert.id} value={expert.id}>{expert.nome}</SelectItem>)}</SelectContent></Select></div><div><Label>Fonte</Label><Select value={sourceType} onValueChange={(value: any) => setSourceType(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales">Vendas consolidadas</SelectItem><SelectItem value="student">Alunas</SelectItem><SelectItem value="model_patient">Pacientes-modelo</SelectItem></SelectContent></Select></div><div><Label>Intervalo automático (minutos)</Label><Input type="number" min={5} value={interval} onChange={(event) => setInterval(event.target.value)} /></div></div><div className="grid gap-3 sm:grid-cols-[1fr_220px]"><div><Label>URL ou ID da planilha</Label><Input value={spreadsheet} onChange={(event) => setSpreadsheet(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></div><div><Label>Nome da aba</Label><Input value={worksheet} onChange={(event) => setWorksheet(event.target.value)} placeholder="Vendas" /></div></div><div><Label>Mapeamento de colunas</Label><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{FIELDS.map(([key, label]) => <div key={key}><span className="mb-1 block text-[10px] font-bold text-muted-foreground">{label}</span><Input value={mapping[key] || ""} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))} placeholder={`Cabeçalho: ${label}`} /></div>)}</div></div><div className="flex flex-wrap items-center gap-2"><Button onClick={() => void save(false)} disabled={!expertId}><Save className="mr-2 h-4 w-4" />Salvar configuração</Button><Button variant="outline" onClick={() => void save(true)} disabled={!expertId || !spreadsheet}><TestTube2 className="mr-2 h-4 w-4" />Testar e sincronizar</Button>{current && <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground"><RefreshCw className="h-3 w-3" />{current.status} · {current.last_sync_at ? new Date(current.last_sync_at).toLocaleString("pt-BR") : "nunca sincronizado"}</span>}</div><Textarea readOnly value={JSON.stringify(mapping, null, 2)} className="hidden" aria-label="Mapeamento salvo" /></div></section>;
}
