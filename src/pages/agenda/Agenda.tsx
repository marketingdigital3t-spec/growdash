import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Filter } from "lucide-react";
import { PageHeader, Button } from "@/components/page-primitives";

const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 8h → 19h
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type Event = {
  day: number; // 0-6
  start: number; // hour
  duration: number; // hours
  patient: string;
  proc: string;
  color: "purple" | "pink" | "green" | "yellow";
};

const EVENTS: Event[] = [
  { day: 0, start: 9, duration: 1, patient: "Amanda Ribeiro", proc: "Consulta inicial", color: "purple" },
  { day: 0, start: 10.5, duration: 1, patient: "Priscila Souza", proc: "Retorno pós-op", color: "pink" },
  { day: 1, start: 8, duration: 1.5, patient: "Beatriz Lima", proc: "Radiofrequência", color: "green" },
  { day: 1, start: 13, duration: 1, patient: "Camila Ferraz", proc: "Avaliação íntima", color: "purple" },
  { day: 2, start: 14, duration: 2, patient: "Larissa Martins", proc: "Peeling químico", color: "yellow" },
  { day: 3, start: 9, duration: 1, patient: "Renata Alves", proc: "Ninfoplastia (retorno)", color: "pink" },
  { day: 3, start: 15, duration: 1, patient: "Juliana Prado", proc: "Consulta", color: "purple" },
  { day: 4, start: 11, duration: 1, patient: "Fernanda Melo", proc: "Laser íntimo", color: "green" },
  { day: 4, start: 16, duration: 1.5, patient: "Isabela Costa", proc: "Avaliação estética", color: "yellow" },
  { day: 5, start: 10, duration: 1, patient: "Mariana Duarte", proc: "Retorno", color: "purple" },
];

const colorStyles = {
  purple: "bg-primary-soft border-primary/30 text-primary",
  pink: "bg-[hsl(340_90%_96%)] border-[hsl(340_85%_75%)] text-[hsl(340_85%_45%)]",
  green: "bg-[hsl(145_65%_92%)] border-[hsl(145_60%_65%)] text-[hsl(145_60%_30%)]",
  yellow: "bg-[hsl(42_100%_94%)] border-[hsl(42_95%_70%)] text-[hsl(35_85%_38%)]",
};

export default function AgendaSemana() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedProf, setSelectedProf] = useState("Todos");

  const weekLabel = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    const day = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `${fmt(monday)} — ${fmt(sunday)}`;
  }, [weekOffset]);

  return (
    <div className="flex h-full flex-col p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Agenda"]}
        title="Agenda semanal"
        subtitle="Visualize e gerencie os atendimentos da semana."
        actions={
          <>
            <Button variant="secondary">
              <Filter className="h-4 w-4" /> Filtros
            </Button>
            <Button>
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Profissional:</span>
          {["Todos", "Dra. Carla", "Dra. Marina"].map((p) => (
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

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: "80px repeat(7, minmax(0, 1fr))" }}>
          <div className="sticky top-0 z-10 border-b border-r border-border bg-card" />
          {DAYS.map((d) => (
            <div
              key={d}
              className="sticky top-0 z-10 border-b border-r border-border bg-card px-3 py-3 text-center text-sm font-extrabold text-foreground"
            >
              {d}
            </div>
          ))}

          {HOURS.map((h) => (
            <FragmentRow key={h} hour={h} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ hour }: { hour: number }) {
  return (
    <>
      <div className="border-b border-r border-border px-2 py-3 text-right text-xs font-bold text-muted-foreground">
        {`${String(hour).padStart(2, "0")}:00`}
      </div>
      {DAYS.map((_, dayIdx) => {
        const evs = EVENTS.filter((e) => e.day === dayIdx && Math.floor(e.start) === hour);
        return (
          <div key={dayIdx} className="relative min-h-[68px] border-b border-r border-border">
            {evs.map((e, i) => {
              const offsetMinutes = (e.start - hour) * 60;
              const topPct = (offsetMinutes / 60) * 100;
              const heightPct = e.duration * 100;
              return (
                <div
                  key={i}
                  className={`absolute inset-x-1 rounded-lg border-l-4 px-2 py-1 text-[11px] font-bold shadow-sm ${colorStyles[e.color]}`}
                  style={{ top: `${topPct}%`, height: `calc(${heightPct}% - 4px)` }}
                >
                  <div className="truncate font-extrabold">{e.patient}</div>
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
