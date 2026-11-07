import { CalendarDays, GraduationCap, Users } from "lucide-react";
import { formatCurrency, formatDateBr } from "@/lib/format/formatPtBr";

export interface ClassBatchRow {
  id: string;
  name: string;
  startDate: string;
  enrolled: number;
  capacity: number;
  status: "open" | "in_progress" | "completed";
  revenueGenerated: number;
}

interface ClassCalendarProps {
  batches: ClassBatchRow[];
  className?: string;
}

const STATUS_CONFIG = {
  open: { label: "Inscrições abertas", className: "border-success/35 bg-success/10 text-success" },
  in_progress: { label: "Em andamento", className: "border-primary/35 bg-primary/10 text-primary-neon" },
  completed: { label: "Encerrada", className: "border-card-border bg-bg-elevated text-text-muted" },
} as const;

/**
 * Agenda & Turmas (seção 9.9 — aba Agenda & Turmas).
 *
 * Lista de turmas em cards com data de início, vagas ocupadas em barra de
 * progresso e status com cor semantica.
 */
export function ClassCalendar({ batches, className = "" }: ClassCalendarProps) {
  return (
    <section
      aria-labelledby="class-calendar-title"
      className={`rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm">
            <GraduationCap className="h-4 w-4" />
          </span>
          <h2 id="class-calendar-title" className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
            Turmas e Mentorias
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
          <CalendarDays className="h-3.5 w-3.5 text-primary-neon" />
          {batches.length} turmas
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {batches.map((batch) => {
          const occupancy =
            batch.capacity > 0 ? Math.min(100, (batch.enrolled / batch.capacity) * 100) : 0;
          const status = STATUS_CONFIG[batch.status];
          const nearlyFull = occupancy >= 90;

          return (
            <article
              key={batch.id}
              className="rounded-xl border border-card-border/70 bg-bg-elevated/50 p-4 transition hover:border-card-border-active hover:shadow-glow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display min-w-0 flex-1 text-sm font-bold leading-snug text-text-primary">
                  {batch.name}
                </h3>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${status.className}`}
                >
                  {status.label}
                </span>
              </div>

              <span className="mt-2 block text-[11px] text-text-muted">
                Início em {formatDateBr(batch.startDate)}
              </span>

              {/* Vagas ocupadas */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-text-secondary">
                    <Users className="h-3 w-3 text-primary-neon" /> Vagas
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      nearlyFull ? "text-warning" : "text-text-primary"
                    }`}
                  >
                    {batch.enrolled}/{batch.capacity}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-card-border bg-bg-elevated">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${occupancy}%`,
                      background: nearlyFull
                        ? "linear-gradient(90deg, #F59E0B, #FF9F1C)"
                        : "var(--gradient-fuel)",
                      boxShadow: "var(--glow-sm)",
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-card-border/50 pt-2.5">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">
                  Receita gerada
                </span>
                <b className="font-display text-sm font-bold text-primary-neon tabular-nums">
                  {formatCurrency(batch.revenueGenerated)}
                </b>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
