import { useState } from "react";
import { Plus, Bell, Calendar, Ban, PartyPopper, Trash2 } from "lucide-react";
import { PageHeader, Button, Badge } from "@/components/page-primitives";
import NewEventDialog from "@/components/NewEventDialog";
import { useClinic, formatDateBR, type EventKind } from "@/store/clinic-store";

const kindMeta: Record<EventKind, { label: string; tone: "primary" | "green" | "yellow" | "red"; Icon: typeof Bell }> = {
  agendamento: { label: "Compromisso", tone: "primary", Icon: Calendar },
  bloqueio: { label: "Bloqueio", tone: "red", Icon: Ban },
  lembrete: { label: "Lembrete", tone: "yellow", Icon: Bell },
  evento: { label: "Evento", tone: "green", Icon: PartyPopper },
};

export default function Eventos() {
  const { events, removeEvent } = useClinic();
  const [filter, setFilter] = useState<"todos" | EventKind>("todos");
  const [open, setOpen] = useState(false);

  const list = events.filter((e) => filter === "todos" || e.kind === filter);

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Agenda", "Eventos"]}
        title="Eventos"
        subtitle="Bloqueios, lembretes e eventos gerais da clínica."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo evento
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
        {(["todos", "agendamento", "bloqueio", "lembrete", "evento"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 rounded-xl px-3 text-xs font-bold capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"
            }`}
          >
            {f === "todos" ? "Todos" : kindMeta[f].label + "s"}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="text-base font-extrabold text-foreground">Nenhum evento cadastrado</h3>
          <p className="mt-1 max-w-sm text-sm font-semibold text-muted-foreground">
            Clique em "Novo evento" para criar seu primeiro bloqueio, lembrete ou evento da clínica.
          </p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Novo evento
          </Button>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((e) => {
            const meta = kindMeta[e.kind];
            const Icon = meta.Icon;
            return (
              <li key={e.id} className="group flex gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-xs font-bold text-muted-foreground">
                      {formatDateBR(e.date)} · {e.time}
                    </span>
                  </div>
                  <h3 className="truncate text-base font-extrabold text-foreground">{e.title}</h3>
                  {e.who && <p className="text-sm font-semibold text-foreground/70">{e.who}</p>}
                  {e.note && <p className="mt-1 text-xs text-muted-foreground">{e.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => removeEvent(e.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-[hsl(0_85%_95%)] hover:text-[hsl(0_70%_50%)] group-hover:opacity-100"
                  aria-label="Remover evento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <NewEventDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
