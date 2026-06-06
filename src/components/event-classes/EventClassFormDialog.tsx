import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdAccounts } from "@/hooks/useAdAccounts";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { useFunnelStages } from "@/hooks/useRDDeals";
import { useCreateEventClass, useUpdateEventClass, type EventClass, type EventClassStatus } from "@/hooks/useEventClasses";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  eventClass?: EventClass | null;
}

const STATUS_OPTIONS: { value: EventClassStatus; label: string }[] = [
  { value: "open", label: "Aberta" },
  { value: "sold_out", label: "Esgotada" },
  { value: "upcoming", label: "Em breve" },
  { value: "cancelled", label: "Cancelada" },
  { value: "finished", label: "Finalizada" },
];

export function EventClassFormDialog({ open, onOpenChange, eventClass }: Props) {
  const { data: accounts } = useAdAccounts();
  const [adAccountId, setAdAccountId] = useState<string>("");
  const { data: funnels } = useRDFunnels(adAccountId || undefined);
  const [funnelId, setFunnelId] = useState<string>("");
  const [modelFunnelId, setModelFunnelId] = useState<string>("");
  const { data: stages } = useFunnelStages(funnelId || undefined);
  const { data: modelStages } = useFunnelStages(modelFunnelId || undefined);
  const create = useCreateEventClass();
  const update = useUpdateEventClass();

  const [form, setForm] = useState({
    title: "",
    date_start: "",
    date_end: "",
    location: "",
    max_people: 20,
    has_model_patients: false,
    max_model_patients: 0,
    status: "open" as EventClassStatus,
    allowed_student_stage_ids: [] as string[],
    allowed_model_patient_stage_ids: [] as string[],
    notes: "",
  });

  useEffect(() => {
    if (eventClass) {
      setAdAccountId(eventClass.ad_account_id);
      setFunnelId(eventClass.rd_funnel_id);
      setModelFunnelId(eventClass.rd_model_patient_funnel_id || "");
      setForm({
        title: eventClass.title,
        date_start: eventClass.date_start,
        date_end: eventClass.date_end || "",
        location: eventClass.location || "",
        max_people: eventClass.max_people || eventClass.max_students || 0,
        has_model_patients: eventClass.has_model_patients,
        max_model_patients: eventClass.max_model_patients,
        status: eventClass.status,
        allowed_student_stage_ids: eventClass.allowed_student_stage_ids,
        allowed_model_patient_stage_ids: eventClass.allowed_model_patient_stage_ids,
        notes: eventClass.notes || "",
      });
    } else if (open) {
      setAdAccountId(accounts?.[0]?.id || "");
      setFunnelId("");
      setModelFunnelId("");
      setForm({
        title: "", date_start: "", date_end: "", location: "",
        max_people: 20, has_model_patients: false, max_model_patients: 0, status: "open",
        allowed_student_stage_ids: [], allowed_model_patient_stage_ids: [], notes: "",
      });
    }
  }, [eventClass, open, accounts]);

  const toggleStage = (key: "allowed_student_stage_ids" | "allowed_model_patient_stage_ids", id: string) => {
    setForm((p) => ({
      ...p,
      [key]: p[key].includes(id) ? p[key].filter((s) => s !== id) : [...p[key], id],
    }));
  };

  const handleSubmit = async () => {
    if (!adAccountId || !funnelId || !form.title || !form.date_start) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    if (form.has_model_patients && (!modelFunnelId || form.max_model_patients <= 0)) {
      toast({ title: "Configure o funil e a quantidade de pacientes-modelo", variant: "destructive" });
      return;
    }
    try {
      const payload: any = {
        title: form.title,
        date_start: form.date_start,
        date_end: form.date_end || null,
        location: form.location || null,
        max_people: form.max_people,
        max_students: form.max_people, // mantém legado em sincronia
        has_model_patients: form.has_model_patients,
        max_model_patients: form.has_model_patients ? form.max_model_patients : 0,
        status: form.status,
        allowed_student_stage_ids: form.allowed_student_stage_ids,
        allowed_model_patient_stage_ids: form.has_model_patients ? form.allowed_model_patient_stage_ids : [],
        notes: form.notes || null,
        ad_account_id: adAccountId,
        rd_funnel_id: funnelId,
        rd_model_patient_funnel_id: form.has_model_patients ? modelFunnelId : null,
      };
      if (eventClass) {
        await update.mutateAsync({ id: eventClass.id, ...payload });
        toast({ title: "Turma atualizada" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: "Turma criada" });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{eventClass ? "Editar turma" : "Nova turma"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da turma *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Turma Presencial - 13 e 14 de Junho" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data início *</Label>
              <Input type="date" value={form.date_start} onChange={(e) => setForm({ ...form, date_start: e.target.value })} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={form.date_end} onChange={(e) => setForm({ ...form, date_end: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Local</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Alphaville - SP" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade de pessoas *</Label>
              <Input type="number" min={0} value={form.max_people}
                onChange={(e) => setForm({ ...form, max_people: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventClassStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Conta de anúncio *</Label>
              <Select value={adAccountId} onValueChange={(v) => { setAdAccountId(v); setFunnelId(""); setModelFunnelId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {(accounts || []).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funil de pessoas (RD) *</Label>
              <Select value={funnelId} onValueChange={setFunnelId} disabled={!adAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
                <SelectContent>
                  {(funnels || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {funnelId && (stages?.length ?? 0) > 0 && (
            <div>
              <Label className="mb-2 block">Etapas aptas para Pessoas</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border border-border p-3">
                {(stages || []).map((s: any) => (
                  <label key={s.rd_stage_id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.allowed_student_stage_ids.includes(s.rd_stage_id)}
                      onCheckedChange={() => toggleStage("allowed_student_stage_ids", s.rd_stage_id)}
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Esta turma tem pacientes-modelo?</Label>
                <p className="text-xs text-muted-foreground">Use quando os pacientes-modelo vêm de um funil diferente.</p>
              </div>
              <Switch
                checked={form.has_model_patients}
                onCheckedChange={(v) => setForm({ ...form, has_model_patients: v })}
              />
            </div>

            {form.has_model_patients && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantidade de pacientes-modelo *</Label>
                    <Input type="number" min={1} value={form.max_model_patients}
                      onChange={(e) => setForm({ ...form, max_model_patients: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label>Funil de pacientes-modelo (RD) *</Label>
                    <Select value={modelFunnelId} onValueChange={setModelFunnelId} disabled={!adAccountId}>
                      <SelectTrigger><SelectValue placeholder="Selecionar funil" /></SelectTrigger>
                      <SelectContent>
                        {(funnels || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {modelFunnelId && (modelStages?.length ?? 0) > 0 && (
                  <div>
                    <Label className="mb-2 block">Etapas aptas para Pacientes-modelo</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border border-border p-3">
                      {(modelStages || []).map((s: any) => (
                        <label key={s.rd_stage_id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={form.allowed_model_patient_stage_ids.includes(s.rd_stage_id)}
                            onCheckedChange={() => toggleStage("allowed_model_patient_stage_ids", s.rd_stage_id)}
                          />
                          <span className="truncate">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
            {eventClass ? "Salvar" : "Criar turma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
