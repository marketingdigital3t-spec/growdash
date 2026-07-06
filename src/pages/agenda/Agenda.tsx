import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Filter, X } from "lucide-react";
import { PageHeader, Button } from "@/components/page-primitives";
import NewAppointmentDialog from "@/components/NewAppointmentDialog";
import { useClinic, weekRange, isoFromDate, type ApptColor } from "@/store/clinic-store";

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 8h → 19h
const DAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const colorStyles: Record<ApptColor, string> = {
  purple: "bg-primary-soft border-primary/30 text-primary",
  pink: "bg-[hsl(340_90%_96%)] border-[hsl(340_85%_75%)] text-[hsl(340_85%_45%)]",
  green: "bg-[hsl(145_65%_92%)] border-[hsl(145_60%_65%)] text-[hsl(145_60%_30%)]",
  yellow: "bg-[hsl(42_100%_94%)] border-[hsl(42_95%_70%)] text-[hsl(35_85%_38%)]",
};

export default function AgendaSemana() {
  const { appointments, removeAppointment } = useClinic();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedProf, setSelectedProf] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; date?: string }>({ open: false });

  const { monday, sunday } = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  const professionals = useMemo(() => {
    const set = new Set<string>();
    appointments.forEach((a) => a.prof && set.add(a.prof));
    return ["Todos", ...Array.from(set).sort()];
  }, [appointments]);

  const weekAppts = useMemo(() => {
    const mondayISO = isoFromDate(monday);
    const sundayISO = isoFromDate(sunday);
    return appointments.filter(
      (a) =>
        a.date >= mondayISO &&
        a.date <= sundayISO &&
        (selectedProf === "Todos" || a.prof === selectedProf),
    );
  }, [appointments, monday, sunday, selectedProf]);

  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const weekLabel = `${fmt(monday)} — ${fmt(sunday)}`;

  return (
    <div className="flex h-full flex-col p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Agenda"]}
        title="Agenda semanal"
        subtitle="Visualize e gerencie os atendimentos da semana."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" /> {showFilters ? "Ocultar filtros" : "Filtros"}
            </Button>
            <Button onClick={() => setDialog({ open: true })}>
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </>
        }
      />

      {/* Controles */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" onClick={() => setWeekOffset(0)}>
            Hoje
          </Button>
          <Button variant="secondary" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-3 text-sm font-extrabold text-foreground">{weekLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Profissional:</span>
          {professionals.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedProf(p)}
              className={`h-9 rounded-xl px-3 text-xs font-bold transition-colors ${
                selectedProf === p ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Use os botões de <strong className="text-foreground">Profissional</strong> acima para filtrar por atendente,
          ou navegue pelas semanas com as setas.
        </div>
      )}

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))" }}>
          <div className="sticky top-0 z-10 border-b border-r border-border bg-card" />
          {weekDates.map((d, i) => (
            <div
              key={i}
              className="sticky top-0 z-10 border-b border-r border-border bg-card px-3 py-3 text-center"
            >
              <div className="text-sm font-extrabold text-foreground">{DAY_LABELS[i]}</div>
              <div className="text-[11px] font-bold text-muted-foreground">{fmt(d)}</div>
            </div>
          ))}

          {HOURS.map((h) => (
            <FragmentRow
              key={h}
              hour={h}
              weekDates={weekDates}
              appts={weekAppts}
              onEmptyClick={(iso) => setDialog({ open: true, date: iso })}
              onRemove={removeAppointment}
            />
          ))}
        </div>
      </div>

      <NewAppointmentDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        defaultDate={dialog.date}
      />
    </div>
  );
}

function FragmentRow({
  hour,
  weekDates,
  appts,
  onEmptyClick,
  onRemove,
}: {
  hour: number;
  weekDates: Date[];
  appts: ReturnType<typeof useClinic>["appointments"];
  onEmptyClick: (iso: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <div className="border-b border-r border-border px-2 py-3 text-right text-xs font-bold text-muted-foreground">
        {`${String(hour).padStart(2, "0")}:00`}
      </div>
      {weekDates.map((d, dayIdx) => {
        const iso = isoFromDate(d);
        const evs = appts.filter((e) => {
          const [hh, mm] = e.time.split(":").map(Number);
          const start = hh + mm / 60;
          return e.date === iso && Math.floor(start) === hour;
        });
        return (
          <div
            key={dayIdx}
            onClick={(ev) => {
              if ((ev.target as HTMLElement).closest("[data-appt]")) return;
              onEmptyClick(iso);
            }}
            className="group/cell relative min-h-[68px] cursor-pointer border-b border-r border-border transition-colors hover:bg-primary-soft/40"
          >
            {evs.map((e) => {
              const [hh, mm] = e.time.split(":").map(Number);
              const start = hh + mm / 60;
              const offsetMinutes = (start - hour) * 60;
              const topPct = (offsetMinutes / 60) * 100;
              const heightPct = e.duration * 100;
              return (
                <div
                  key={e.id}
                  data-appt
                  className={`group/appt absolute inset-x-1 rounded-lg border-l-4 px-2 py-1 text-[11px] font-bold shadow-sm ${colorStyles[e.color]}`}
                  style={{ top: `${topPct}%`, height: `calc(${heightPct}% - 4px)` }}
                >
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onRemove(e.id);
                    }}
                    className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-white/70 text-foreground/70 hover:bg-white group-hover/appt:flex"
                    aria-label="Remover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="truncate pr-4 font-extrabold">{e.patient}</div>
                  <div className="truncate opacity-80">{e.proc}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
