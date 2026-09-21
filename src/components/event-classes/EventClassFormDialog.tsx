import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateEventClass, useUpdateEventClass, type EventClass, type EventClassStatus } from "@/hooks/useEventClasses";
import { toast } from "@/hooks/use-toast";

interface Props { open: boolean; onOpenChange: (value: boolean) => void; eventClass?: EventClass | null; }
const STATUS_OPTIONS: { value: EventClassStatus; label: string }[] = [
  { value: "open", label: "Aberta" }, { value: "upcoming", label: "Em breve" }, { value: "sold_out", label: "Esgotada" }, { value: "cancelled", label: "Cancelada" }, { value: "finished", label: "Finalizada" },
];
const empty = { title: "", expert_name: "", date_start: "", date_end: "", location: "", max_students: 0, max_people: 0, max_model_patients: 0, status: "open" as EventClassStatus, notes: "" };

export function EventClassFormDialog({ open, onOpenChange, eventClass }: Props) {
  const create = useCreateEventClass(); const update = useUpdateEventClass();
  const [form, setForm] = useState(empty);
  useEffect(() => {
    if (eventClass) setForm({ title: eventClass.title, expert_name: eventClass.expert_name || "", date_start: eventClass.date_start, date_end: eventClass.date_end || "", location: eventClass.location || "", max_students: Number(eventClass.max_students || eventClass.max_people || 0), max_people: Number(eventClass.max_people || eventClass.max_students || 0), max_model_patients: Number(eventClass.max_model_patients || 0), status: eventClass.status, notes: eventClass.notes || "" });
    else if (open) setForm(empty);
  }, [eventClass, open]);
  const set = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!form.title.trim() || !form.expert_name.trim() || !form.date_start) { toast({ title: "Informe nome, expert e data inicial.", variant: "destructive" }); return; }
    if (form.date_end && form.date_end < form.date_start) { toast({ title: "A data final não pode ser anterior à inicial.", variant: "destructive" }); return; }
    const payload = { ...form, title: form.title.trim(), expert_name: form.expert_name.trim(), date_end: form.date_end || null, location: form.location.trim() || null, notes: form.notes.trim() || null, max_students: Math.max(0, form.max_students), max_people: Math.max(0, form.max_students), max_model_patients: Math.max(0, form.max_model_patients) };
    try { if (eventClass) await update.mutateAsync({ id: eventClass.id, ...payload }); else await create.mutateAsync(payload); toast({ title: eventClass ? "Turma atualizada" : "Turma criada" }); onOpenChange(false); } catch (error: any) { toast({ title: "Não foi possível salvar a turma", description: error?.message, variant: "destructive" }); }
  };
  const pending = create.isPending || update.isPending;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{eventClass ? "Editar turma" : "Nova turma manual"}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">
    <div className="sm:col-span-2"><Label>Nome da turma *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Turma Alpha Outubro" /></div>
    <div><Label>Expert *</Label><Input value={form.expert_name} onChange={(e) => set("expert_name", e.target.value)} placeholder="Nome livre do expert" /></div>
    <div><Label>Status</Label><Select value={form.status} onValueChange={(value) => set("status", value as EventClassStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
    <div><Label>Data inicial *</Label><Input type="date" value={form.date_start} onChange={(e) => set("date_start", e.target.value)} /></div><div><Label>Data final</Label><Input type="date" value={form.date_end} onChange={(e) => set("date_end", e.target.value)} /></div>
    <div><Label>Local</Label><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Local ou endereço" /></div>
    <div><Label>Capacidade de alunas</Label><Input type="number" min={0} value={form.max_students} onChange={(e) => set("max_students", Number(e.target.value) || 0)} /></div>
    <div><Label>Capacidade de pacientes-modelo</Label><Input type="number" min={0} value={form.max_model_patients} onChange={(e) => set("max_model_patients", Number(e.target.value) || 0)} /></div>
    <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Informações operacionais da turma" /></div>
  </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={() => void submit()} disabled={pending}>{pending ? "Salvando…" : "Salvar turma"}</Button></DialogFooter></DialogContent></Dialog>;
}
