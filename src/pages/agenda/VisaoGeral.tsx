import { useMemo } from "react";
import { CheckCircle2, Clock, XCircle, TrendingUp, CalendarDays, UserCheck } from "lucide-react";
import { PageHeader, StatCard, Badge } from "@/components/page-primitives";
import { useClinic } from "@/store/clinic-store";

export default function AgendaVisaoGeral() {
  const { appointments } = useClinic();

  const stats = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter((a) => a.status === "confirmado").length;
    const waiting = appointments.filter((a) => a.status === "aguardando").length;
    const cancelled = appointments.filter((a) => a.status === "cancelado").length;
    return { total, confirmed, waiting, cancelled };
  }, [appointments]);

  const topProfs = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((a) => {
      if (!a.prof) return;
      map.set(a.prof, (map.get(a.prof) || 0) + 1);
    });
    const arr = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    const max = Math.max(1, ...arr.map((p) => p.count));
    return arr
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({ ...p, pct: Math.round((p.count / max) * 100) }));
  }, [appointments]);

  const topProcs = useMemo(() => {
    const map = new Map<string, number>();
    appointments.forEach((a) => map.set(a.proc, (map.get(a.proc) || 0) + 1));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [appointments]);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Visão geral"]}
        title="Visão geral da Agenda"
        subtitle="Indicadores calculados a partir dos seus agendamentos."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Agendamentos" value={String(stats.total)} hint="Total registrado" accent="primary" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard label="Confirmados" value={String(stats.confirmed)} hint={stats.total ? `${Math.round((stats.confirmed / stats.total) * 100)}% da agenda` : "—"} accent="green" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Aguardando" value={String(stats.waiting)} hint="A confirmar" accent="yellow" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Cancelados" value={String(stats.cancelled)} hint={stats.total ? `${Math.round((stats.cancelled / stats.total) * 100)}%` : "—"} accent="pink" icon={<XCircle className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Top profissionais</h2>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          {topProfs.length === 0 ? (
            <EmptyState text="Sem dados ainda. Crie agendamentos para ver o ranking." />
          ) : (
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
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Procedimentos mais realizados</h2>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          {topProcs.length === 0 ? (
            <EmptyState text="Nenhum procedimento realizado ainda." />
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-8 text-center text-sm font-semibold text-muted-foreground">
      {text}
    </div>
  );
}
