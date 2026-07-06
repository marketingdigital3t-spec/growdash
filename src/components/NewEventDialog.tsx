import { useState, useEffect } from "react";
import { Modal, Field, TextInput, SelectInput, TextArea } from "./Modal";
import { Button } from "./page-primitives";
import { useClinic, todayISO, type ClinicEvent, type EventKind } from "@/store/clinic-store";

export default function NewEventDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addEvent } = useClinic();
  const [form, setForm] = useState<Omit<ClinicEvent, "id">>({
    kind: "evento",
    title: "",
    date: todayISO(),
    time: "09:00",
    who: "",
    note: "",
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, date: todayISO() }));
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title.trim()) return;
    addEvent(form);
    onClose();
    setForm({ kind: "evento", title: "", date: todayISO(), time: "09:00", who: "", note: "" });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo evento"
      subtitle="Cadastre um lembrete, bloqueio ou evento da clínica."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!form.title.trim()}>
            Criar evento
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Tipo">
          <SelectInput value={form.kind} onChange={(e) => set("kind", e.target.value as EventKind)}>
            <option value="evento">Evento</option>
            <option value="lembrete">Lembrete</option>
            <option value="bloqueio">Bloqueio de agenda</option>
            <option value="agendamento">Compromisso</option>
          </SelectInput>
        </Field>
        <Field label="Título">
          <TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Reunião com fornecedor" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <TextInput type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Hora">
            <TextInput type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
        </div>
        <Field label="Local / responsável" hint="Opcional">
          <TextInput value={form.who || ""} onChange={(e) => set("who", e.target.value)} placeholder="Ex.: Sala 2, Dra. Carla" />
        </Field>
        <Field label="Observações" hint="Opcional">
          <TextArea value={form.note || ""} onChange={(e) => set("note", e.target.value)} placeholder="Detalhes do evento..." />
        </Field>
      </div>
    </Modal>
  );
}
