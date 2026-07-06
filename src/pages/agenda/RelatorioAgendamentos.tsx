import { useMemo, useState } from "react";
import { Search, Download, Plus, Trash2 } from "lucide-react";
import { PageHeader, Button, Input, Badge } from "@/components/page-primitives";
import NewAppointmentDialog from "@/components/NewAppointmentDialog";
import { useClinic, formatDateBR, type ApptStatus } from "@/store/clinic-store";

const TABS: { key: "todos" | ApptStatus; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "confirmado", label: "Confirmados" },
  { key: "aguardando", label: "Aguardando" },
  { key: "realizado", label: "Realizados" },
  { key: "cancelado", label: "Cancelados" },
];

const statusTone: Record<ApptStatus, "green" | "yellow" | "primary" | "red"> = {
  realizado: "green",
  aguardando: "yellow",
  confirmado: "primary",
  cancelado: "red",
};

export default function RelatorioAgendamentos() {
  const { appointments, removeAppointment } = useClinic();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todos");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    return appointments
      .filter((r) => (tab === "todos" ? true : r.status === tab))
      .filter((r) =>
        q ? [r.patient, r.prof, r.proc, r.id].some((v) => v.toLowerCase().includes(q.toLowerCase())) : true,
      )
      .sort((a, b) => (a.date + a.time > b.date + b.time ? -1 : 1));
  }, [appointments, tab, q]);

  const counts = useMemo(
    () => ({
      todos: appointments.length,
      confirmado: appointments.filter((r) => r.status === "confirmado").length,
      aguardando: appointments.filter((r) => r.status === "aguardando").length,
      realizado: appointments.filter((r) => r.status === "realizado").length,
      cancelado: appointments.filter((r) => r.status === "cancelado").length,
    }),
    [appointments],
  );

  const exportCsv = () => {
    const header = ["Código", "Data", "Hora", "Paciente", "Profissional", "Procedimento", "Status", "Valor"];
    const rows = filtered.map((r) => [r.id, r.date, r.time, r.patient, r.prof, r.proc, r.status, String(r.value)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agendamentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Relatório de agendamentos"]}
        title="Relatório de agendamentos"
        subtitle="Acompanhe cada atendimento por status."
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                tab === t.key ? "bg-white/25" : "bg-muted"
              }`}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por paciente, profissional, código..."
            className="w-full pl-9"
          />
        </div>
        <span className="text-xs font-bold text-muted-foreground">{filtered.length} resultado(s)</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60 text-xs font-extrabold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Profissional</th>
              <th className="px-4 py-3">Procedimento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id} className="group transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-bold text-foreground">{r.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground/80">
                  {formatDateBR(r.date)} · {r.time}
                </td>
                <td className="px-4 py-3 font-extrabold text-foreground">{r.patient}</td>
                <td className="px-4 py-3 font-semibold text-foreground/70">{r.prof || "—"}</td>
                <td className="px-4 py-3 text-foreground/80">{r.proc}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-foreground">
                  {r.value ? `R$ ${r.value.toLocaleString("pt-BR")}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeAppointment(r.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-[hsl(0_85%_95%)] hover:text-[hsl(0_70%_50%)] group-hover:opacity-100"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm font-semibold text-muted-foreground">
                  Nenhum agendamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <NewAppointmentDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
