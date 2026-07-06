import { CheckCircle2, Clock, XCircle, TrendingUp, CalendarDays, UserCheck } from "lucide-react";
import { PageHeader, StatCard, Badge } from "@/components/page-primitives";

const topProfs = [
  { name: "Dra. Carla Rezende", count: 48, pct: 62 },
  { name: "Dra. Marina Antunes", count: 22, pct: 28 },
  { name: "Enf. Paula Souza", count: 8, pct: 10 },
];

const topProcs = [
  { name: "Consulta inicial", count: 28 },
  { name: "Radiofrequência íntima", count: 19 },
  { name: "Peeling químico", count: 12 },
  { name: "Laser íntimo", count: 9 },
  { name: "Retorno pós-op", count: 8 },
];

export default function AgendaVisaoGeral() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Visão geral"]}
        title="Visão geral da Agenda"
        subtitle="Indicadores dos últimos 30 dias."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Agendamentos" value="78" hint="+18% vs mês anterior" accent="primary" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Confirmados" value="62" hint="79% da agenda" accent="green" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Aguardando" value="9" hint="Confirmar até 24h antes" accent="yellow" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Cancelados / Faltas" value="7" hint="9% \u2014 abaixo da meta" accent="pink" icon={<XCircle className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Top profissionais</h2>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="flex flex-col gap-4">
            {topProfs.map((p) => (
              <li key={p.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-extrabold text-foreground">{p.name}</span>
                  <span className="font-bold text-muted-foreground">{p.count} atend.</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Procedimentos mais realizados</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {topProcs.map((p, i) => (
              <li key={p.name} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-extrabold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm font-bold text-foreground">{p.name}</span>
                </div>
                <Badge tone="primary">{p.count}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
