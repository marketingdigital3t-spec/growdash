import { useState } from "react";
import { Calendar, CalendarDays, Clock, Plus, Users, Video } from "lucide-react";
import { ClassCalendar, type ClassBatchRow } from "@/components/dashboard/ClassCalendar";
import { MOCK_CLASSES } from "@/lib/mock/mockData";

interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: "aula" | "mentoria" | "call" | "lancamento";
  host: string;
}

const MOCK_EVENTS: ScheduleEvent[] = [
  {
    id: "e1",
    title: "Mentoria Coletiva — Escala 100k",
    date: "2026-11-10",
    time: "19:00",
    type: "mentoria",
    host: "Thiego Jesus",
  },
  {
    id: "e2",
    title: "Live de Alinhamento de Criativos",
    date: "2026-11-12",
    time: "15:30",
    type: "call",
    host: "Mariana Duarte",
  },
  {
    id: "e3",
    title: "Aula Inaugural — Turma Alpha",
    date: "2026-11-20",
    time: "20:00",
    type: "aula",
    host: "Thiego Jesus",
  },
  {
    id: "e4",
    title: "Lançamento Produto Black VIP",
    date: "2026-11-25",
    time: "09:00",
    type: "lancamento",
    host: "Time de Growth",
  },
];

const TYPE_CONFIG = {
  aula: { label: "Aula", className: "border-primary/40 bg-primary/10 text-primary-neon" },
  mentoria: { label: "Mentoria", className: "border-warning/40 bg-warning/10 text-warning" },
  call: { label: "Call de vendas", className: "border-info/40 bg-info/10 text-info" },
  lancamento: { label: "Lançamento", className: "border-danger/40 bg-danger/10 text-danger" },
};

/**
 * Aba Agenda & Turmas (TRIPULAÇÃO) — Seção 9.9.
 */
export default function AgendaTurmasPage() {
  const [batches] = useState<ClassBatchRow[]>(MOCK_CLASSES);
  const [events] = useState<ScheduleEvent[]>(MOCK_EVENTS);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Cabecalho da pagina */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-card-border bg-card-bg/80 p-6 shadow-glow-sm backdrop-blur-xl">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-neon">
            Tripulação da Missão
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Agenda & Turmas
          </h1>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">
            Organize encontros, mentorias, aulas e a ocupação das turmas em um só painel cósmico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-card-border bg-primary/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-neon shadow-glow-sm transition hover:bg-primary/20"
          >
            <Plus className="h-4 w-4" /> Nova Turma
          </button>
        </div>
      </div>

      {/* Calendario de proximos eventos */}
      <section aria-label="Próximos eventos" className="rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm">
              <Calendar className="h-4 w-4" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
              Próximos Encontros da Missão
            </h2>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            {events.length} agendados
          </span>
        </div>

        <div className="mt-4 divide-y divide-card-border/60">
          {events.map((evt) => {
            const conf = TYPE_CONFIG[evt.type];
            return (
              <div key={evt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-card-border bg-bg-elevated/70 text-text-primary shadow-sm">
                    <Video className="h-4 w-4 text-primary-neon" />
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate text-sm font-bold text-text-primary">
                      {evt.title}
                    </b>
                    <span className="flex items-center gap-2 text-[11px] text-text-muted">
                      <span>Responsável: {evt.host}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {evt.time}
                      </span>
                    </span>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${conf.className}`}
                >
                  {conf.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lista de turmas com vagas e barra de ocupacao */}
      <ClassCalendar batches={batches} />
    </div>
  );
}
