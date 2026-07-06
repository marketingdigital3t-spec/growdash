import { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { PageHeader, Button, Input, Badge } from "@/components/page-primitives";

type Status = "confirmado" | "aguardando" | "realizado" | "cancelado";

type Row = {
  id: string;
  date: string;
  time: string;
  patient: string;
  prof: string;
  proc: string;
  status: Status;
  value: number;
};

const ROWS: Row[] = [
  { id: "AG-1041", date: "12/03", time: "09:00", patient: "Amanda Ribeiro", prof: "Dra. Carla", proc: "Consulta inicial", status: "realizado", value: 450 },
  { id: "AG-1042", date: "12/03", time: "10:30", patient: "Priscila Souza", prof: "Dra. Carla", proc: "Retorno pós-op", status: "realizado", value: 0 },
  { id: "AG-1043", date: "13/03", time: "08:00", patient: "Beatriz Lima", prof: "Dra. Marina", proc: "Radiofrequência", status: "confirmado", value: 380 },
  { id: "AG-1044", date: "13/03", time: "13:00", patient: "Camila Ferraz", prof: "Dra. Carla", proc: "Avaliação íntima", status: "confirmado", value: 300 },
  { id: "AG-1045", date: "14/03", time: "14:00", patient: "Larissa Martins", prof: "Dra. Carla", proc: "Peeling químico", status: "aguardando", value: 520 },
  { id: "AG-1046", date: "14/03", time: "16:30", patient: "Renata Alves", prof: "Dra. Marina", proc: "Ninfoplastia (ret.)", status: "cancelado", value: 0 },
  { id: "AG-1047", date: "15/03", time: "09:00", patient: "Juliana Prado", prof: "Dra. Carla", proc: "Consulta", status: "confirmado", value: 450 },
  { id: "AG-1048", date: "15/03", time: "11:00", patient: "Fernanda Melo", prof: "Dra. Marina", proc: "Laser íntimo", status: "aguardando", value: 680 },
];

const TABS: { key: "todos" | Status; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "confirmado", label: "Confirmados" },
  { key: "aguardando", label: "Aguardando" },
  { key: "realizado", label: "Realizados" },
  { key: "cancelado", label: "Cancelados" },
];

const statusTone: Record<Status, "green" | "yellow" | "primary" | "red"> = {
  realizado: "green",
  aguardando: "yellow",
  confirmado: "primary",
  cancelado: "red",
};

export default function RelatorioAgendamentos() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todos");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return ROWS.filter((r) => (tab === "todos" ? true : r.status === tab)).filter((r) =>
      q ? [r.patient, r.prof, r.proc, r.id].some((v) => v.toLowerCase().includes(q.toLowerCase())) : true,
    );
  }, [tab, q]);

  const counts = useMemo(
    () => ({
      todos: ROWS.length,
      confirmado: ROWS.filter((r) => r.status === "confirmado").length,
      aguardando: ROWS.filter((r) => r.status === "aguardando").length,
      realizado: ROWS.filter((r) => r.status === "realizado").length,
      cancelado: ROWS.filter((r) => r.status === "cancelado").length,
    }),
    [],
  );

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Relatório de agendamentos"]}
        title="Relatório de agendamentos"
        subtitle="Acompanhe cada atendimento por status."
        actions={
          <Button variant="secondary">
            <Download className="h-4 w-4" /> Exportar
          </Button>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3 font-bold text-foreground">{r.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground/80">
                  {r.date} · {r.time}
                </td>
                <td className="px-4 py-3 font-extrabold text-foreground">{r.patient}</td>
                <td className="px-4 py-3 font-semibold text-foreground/70">{r.prof}</td>
                <td className="px-4 py-3 text-foreground/80">{r.proc}</td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right font-extrabold text-foreground">
                  {r.value ? `R$ ${r.value.toLocaleString("pt-BR")}` : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-muted-foreground">
                  Nenhum agendamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
