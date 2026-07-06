import { useState, useEffect } from "react";
import { Modal, Field, TextInput, SelectInput } from "./Modal";
import { Button } from "./page-primitives";
import { useClinic, todayISO, type Appointment, type ApptStatus, type ApptColor } from "@/store/clinic-store";

export default function NewAppointmentDialog({
  open,
  onClose,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  defaultDate?: string;
}) {
  const { addAppointment } = useClinic();
  const [form, setForm] = useState<Omit<Appointment, "id">>({
    date: defaultDate || todayISO(),
    time: "09:00",
    duration: 1,
    patient: "",
    prof: "",
    proc: "",
    status: "confirmado",
    value: 0,
    color: "purple",
  });

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, date: defaultDate || todayISO() }));
    }
  }, [open, defaultDate]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.patient.trim() || !form.proc.trim()) return;
    addAppointment(form);
    onClose();
    setForm({
      date: todayISO(),
      time: "09:00",
      duration: 1,
      patient: "",
      prof: "",
      proc: "",
      status: "confirmado",
      value: 0,
      color: "purple",
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo agendamento"
      subtitle="Preencha os dados do atendimento."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!form.patient.trim() || !form.proc.trim()}>
            Criar agendamento
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Paciente">
          <TextInput
            value={form.patient}
            onChange={(e) => set("patient", e.target.value)}
            placeholder="Nome completo da paciente"
          />
        </Field>
        <Field label="Procedimento">
          <TextInput
            value={form.proc}
            onChange={(e) => set("proc", e.target.value)}
            placeholder="Ex.: Consulta inicial"
          />
        </Field>
        <Field label="Profissional">
          <TextInput
            value={form.prof}
            onChange={(e) => set("prof", e.target.value)}
            placeholder="Ex.: Dra. Carla"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <TextInput type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Hora">
            <TextInput type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Duração (h)">
            <TextInput
              type="number"
              min={0.5}
              step={0.5}
              value={form.duration}
              onChange={(e) => set("duration", Math.max(0.5, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Valor (R$)">
            <TextInput
              type="number"
              min={0}
              step={10}
              value={form.value}
              onChange={(e) => set("value", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="Cor">
            <SelectInput value={form.color} onChange={(e) => set("color", e.target.value as ApptColor)}>
              <option value="purple">Roxo</option>
              <option value="pink">Rosa</option>
              <option value="green">Verde</option>
              <option value="yellow">Amarelo</option>
            </SelectInput>
          </Field>
        </div>
        <Field label="Status">
          <SelectInput value={form.status} onChange={(e) => set("status", e.target.value as ApptStatus)}>
            <option value="confirmado">Confirmado</option>
            <option value="aguardando">Aguardando</option>
            <option value="realizado">Realizado</option>
            <option value="cancelado">Cancelado</option>
          </SelectInput>
        </Field>
      </div>
    </Modal>
  );
}
