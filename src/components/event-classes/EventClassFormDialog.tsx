import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useFunnelStages } from "@/hooks/useRDDeals";
import { useCreateEventClass, useUpdateEventClass, type EventClass, type EventClassSource, type EventClassStatus, type MemberType } from "@/hooks/useEventClasses";
import { toast } from "@/hooks/use-toast";

interface Props { open: boolean; onOpenChange: (value: boolean) => void; eventClass?: EventClass | null; }
const STATUS_OPTIONS: { value: EventClassStatus; label: string }[] = [
  { value: "open", label: "Aberta" }, { value: "sold_out", label: "Esgotada" }, { value: "upcoming", label: "Em breve" }, { value: "cancelled", label: "Cancelada" }, { value: "finished", label: "Finalizada" },
];
const emptySource = (adAccountId = ""): EventClassSource => ({ ad_account_id: adAccountId || null, rd_funnel_id: "", member_type: "student", allowed_stage_ids: [] });

function SourceCard({ source, accounts, onChange, onRemove }: { source: EventClassSource; accounts: any[]; onChange: (source: EventClassSource) => void; onRemove: () => void }) {
  const { data: funnels } = useRDFunnels(source.ad_account_id || undefined, true);
  const { data: stages } = useFunnelStages(source.rd_funnel_id || undefined);
  const setType = (memberType: MemberType) => onChange({ ...source, member_type: memberType });
  const toggleStage = (stageId: string) => onChange({ ...source, allowed_stage_ids: source.allowed_stage_ids.includes(stageId) ? source.allowed_stage_ids.filter((id) => id !== stageId) : [...source.allowed_stage_ids, stageId] });

  return <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <Label className="text-sm">Fonte vinculada</Label>
        <p className="text-xs text-muted-foreground">Esta origem preenche a capacidade da turma abaixo.</p>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Remover fonte" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div><Label>Tipo *</Label><Select value={source.member_type} onValueChange={(value) => setType(value as MemberType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Alunas / pessoas</SelectItem><SelectItem value="model_patient">Pacientes-modelo</SelectItem></SelectContent></Select></div>
      <div><Label>Conta de anúncio *</Label><Select value={source.ad_account_id || "none"} onValueChange={(value) => onChange({ ...source, ad_account_id: value === "none" ? null : value, rd_funnel_id: "", allowed_stage_ids: [] })}><SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger><SelectContent><SelectItem value="none">Sem conta vinculada</SelectItem>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>
      <div><Label>Funil RD *</Label><Select value={source.rd_funnel_id || "none"} onValueChange={(value) => onChange({ ...source, rd_funnel_id: value === "none" ? "" : value, allowed_stage_ids: [] })} disabled={!source.ad_account_id}><SelectTrigger><SelectValue placeholder="Selecionar funil" /></SelectTrigger><SelectContent><SelectItem value="none">Selecionar funil</SelectItem>{(funnels || []).map((funnel) => <SelectItem key={funnel.id} value={funnel.id}>{funnel.name}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {source.rd_funnel_id && (stages?.length ?? 0) > 0 && <div>
      <Label className="mb-2 block">Etapas aptas para esta fonte</Label>
      <p className="mb-2 text-xs text-muted-foreground">Sem seleção, todas as vendas ganhas deste funil entram na turma.</p>
      <div className="grid max-h-36 grid-cols-1 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
        {(stages || []).map((stage: any) => <label key={stage.rd_stage_id} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={source.allowed_stage_ids.includes(stage.rd_stage_id)} onCheckedChange={() => toggleStage(stage.rd_stage_id)} /><span className="truncate">{stage.name}</span></label>)}
      </div>
    </div>}
  </div>;
}

export function EventClassFormDialog({ open, onOpenChange, eventClass }: Props) {
  const { data: accounts } = useAdAccounts();
  const create = useCreateEventClass();
  const update = useUpdateEventClass();
  const [sourceMode, setSourceMode] = useState<"rd" | "custom">("rd");
  const [sources, setSources] = useState<EventClassSource[]>([]);
  const [form, setForm] = useState({ title: "", date_start: "", date_end: "", location: "", max_people: 20, manual_student_count: 0, has_model_patients: false, max_model_patients: 0, manual_model_patient_count: 0, status: "open" as EventClassStatus, notes: "" });

  useEffect(() => {
    if (eventClass) {
      const savedSources = (eventClass as any).sources as EventClassSource[] | undefined;
      const legacySources = [
        eventClass.rd_funnel_id && { ad_account_id: eventClass.ad_account_id, rd_funnel_id: eventClass.rd_funnel_id, member_type: "student" as const, allowed_stage_ids: eventClass.allowed_student_stage_ids },
        eventClass.has_model_patients && eventClass.rd_model_patient_funnel_id && { ad_account_id: eventClass.ad_account_id, rd_funnel_id: eventClass.rd_model_patient_funnel_id, member_type: "model_patient" as const, allowed_stage_ids: eventClass.allowed_model_patient_stage_ids },
      ].filter(Boolean) as EventClassSource[];
      setSourceMode((savedSources?.length || legacySources.length) ? "rd" : "custom");
      setSources((savedSources?.length ? savedSources : legacySources).map(({ id, event_class_id, funnel_name, ad_account_name, ...source }) => source));
      setForm({ title: eventClass.title, date_start: eventClass.date_start, date_end: eventClass.date_end || "", location: eventClass.location || "", max_people: eventClass.max_people || eventClass.max_students || 0, manual_student_count: Number(eventClass.manual_student_count || 0), has_model_patients: eventClass.has_model_patients, max_model_patients: eventClass.max_model_patients, manual_model_patient_count: Number(eventClass.manual_model_patient_count || 0), status: eventClass.status, notes: eventClass.notes || "" });
    } else if (open) {
      setSourceMode("rd"); setSources([emptySource(accounts?.[0]?.id || "")]);
      setForm({ title: "", date_start: "", date_end: "", location: "", max_people: 20, manual_student_count: 0, has_model_patients: false, max_model_patients: 0, manual_model_patient_count: 0, status: "open", notes: "" });
    }
  }, [eventClass, open, accounts]);

  const updateSource = (index: number, source: EventClassSource) => setSources((items) => items.map((item, itemIndex) => itemIndex === index ? source : item));
  const addSource = () => setSources((items) => [...items, emptySource(accounts?.[0]?.id || "")]);
  const removeSource = (index: number) => setSources((items) => items.filter((_, itemIndex) => itemIndex !== index));
  const modelSourceExists = sources.some((source) => source.member_type === "model_patient");

  const handleSubmit = async () => {
    const validSources = sourceMode === "rd" ? sources.filter((source) => source.ad_account_id && source.rd_funnel_id) : [];
    if (!form.title || !form.date_start || (sourceMode === "rd" && (validSources.length === 0 || validSources.length !== sources.length))) { toast({ title: "Preencha conta e funil em cada fonte", variant: "destructive" }); return; }
    const hasModelPatients = form.has_model_patients || modelSourceExists;
    if (hasModelPatients && form.max_model_patients <= 0) { toast({ title: "Informe a quantidade de pacientes-modelo", variant: "destructive" }); return; }
    if (modelSourceExists && !hasModelPatients) { toast({ title: "Ative a capacidade de pacientes-modelo", variant: "destructive" }); return; }
    const studentSource = validSources.find((source) => source.member_type === "student");
    const modelSource = validSources.find((source) => source.member_type === "model_patient");
    const payload: any = { title: form.title, date_start: form.date_start, date_end: form.date_end || null, location: form.location || null, max_people: form.max_people, max_students: form.max_people, manual_student_count: form.manual_student_count, has_model_patients: hasModelPatients, max_model_patients: hasModelPatients ? form.max_model_patients : 0, manual_model_patient_count: hasModelPatients ? form.manual_model_patient_count : 0, status: form.status, notes: form.notes || null, sources: validSources, ad_account_id: studentSource?.ad_account_id || modelSource?.ad_account_id || null, rd_funnel_id: studentSource?.rd_funnel_id || null, rd_model_patient_funnel_id: modelSource?.rd_funnel_id || null, allowed_student_stage_ids: studentSource?.allowed_stage_ids || [], allowed_model_patient_stage_ids: modelSource?.allowed_stage_ids || [] };
    try {
      if (eventClass) { await update.mutateAsync({ id: eventClass.id, ...payload }); toast({ title: "Turma atualizada", description: `${validSources.length} fonte(s) vinculada(s).` }); }
      else { await create.mutateAsync(payload); toast({ title: "Turma criada", description: `${validSources.length} fonte(s) vinculada(s).` }); }
      onOpenChange(false);
    } catch (error: any) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{eventClass ? "Editar turma" : "Nova turma"}</DialogTitle></DialogHeader><div className="space-y-4">
    <div><Label>Nome da turma *</Label><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Turma Presencial - 13 e 14 de Junho" /></div>
    <div className="grid grid-cols-2 gap-3"><div><Label>Data início *</Label><Input type="date" value={form.date_start} onChange={(event) => setForm({ ...form, date_start: event.target.value })} /></div><div><Label>Data fim</Label><Input type="date" value={form.date_end} onChange={(event) => setForm({ ...form, date_end: event.target.value })} /></div></div>
    <div><Label>Local</Label><Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Alphaville - SP" /></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><Label>Quantidade de alunas / pessoas *</Label><Input type="number" min={0} value={form.max_people} onChange={(event) => setForm({ ...form, max_people: parseInt(event.target.value) || 0 })} /></div><div><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as EventClassStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent></Select></div></div>
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-3"><Label>Vagas preenchidas manualmente — alunas/pessoas</Label><Input type="number" min={0} value={form.manual_student_count} onChange={(event) => setForm({ ...form, manual_student_count: parseInt(event.target.value) || 0 })} /></div>
    <div className="rounded-xl border border-border p-4"><Label className="mb-2 block">Origem da turma *</Label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setSourceMode("rd")} className={`rounded-lg border p-3 text-left text-xs ${sourceMode === "rd" ? "border-primary bg-primary/10" : "border-border"}`}><b className="block">RD Station</b><span className="mt-1 block text-[10px] text-muted-foreground">Vincule uma ou mais contas e funis.</span></button><button type="button" onClick={() => { setSourceMode("custom"); setSources([]); }} className={`rounded-lg border p-3 text-left text-xs ${sourceMode === "custom" ? "border-primary bg-primary/10" : "border-border"}`}><b className="block">Personalizado</b><span className="mt-1 block text-[10px] text-muted-foreground">Controle a ocupação manualmente.</span></button></div></div>
    {sourceMode === "rd" && <div className="space-y-3"><div className="flex items-end justify-between gap-4"><div><Label className="text-base">Fontes vinculadas ao RD</Label><p className="text-xs text-muted-foreground">Todas alimentam a mesma turma, mas cada tipo mantém sua própria capacidade.</p></div><Button type="button" variant="outline" size="sm" onClick={addSource}><Plus className="mr-1 h-4 w-4" />Adicionar conta / funil</Button></div>{sources.map((source, index) => <SourceCard key={`${source.rd_funnel_id}-${index}`} source={source} accounts={accounts || []} onChange={(next) => updateSource(index, next)} onRemove={() => removeSource(index)} />)}<div className="flex flex-wrap gap-2">{sources.map((source, index) => <Badge key={index} variant="secondary">{source.member_type === "student" ? "Alunas" : "Pacientes-modelo"} · {source.rd_funnel_id ? "funil selecionado" : "funil pendente"}</Badge>)}</div></div>}
    <div className="space-y-3 rounded-xl border border-border p-4"><div className="flex items-center justify-between"><div><Label>Esta turma tem pacientes-modelo?</Label><p className="text-xs text-muted-foreground">Fontes de pacientes-modelo preenchem uma capacidade separada.</p></div><Switch checked={form.has_model_patients || modelSourceExists} onCheckedChange={(value) => setForm({ ...form, has_model_patients: value })} /></div>{(form.has_model_patients || modelSourceExists) && <><div><Label>Quantidade de pacientes-modelo *</Label><Input type="number" min={1} value={form.max_model_patients} onChange={(event) => setForm({ ...form, max_model_patients: parseInt(event.target.value) || 0 })} /></div><div className="rounded-md border border-dashed border-border bg-muted/20 p-3"><Label>Vagas preenchidas manualmente — pacientes-modelo</Label><Input type="number" min={0} value={form.manual_model_patient_count} onChange={(event) => setForm({ ...form, manual_model_patient_count: parseInt(event.target.value) || 0 })} /></div></>}</div>
    <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
  </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>{eventClass ? "Salvar" : "Criar turma"}</Button></DialogFooter></DialogContent></Dialog>;
}
