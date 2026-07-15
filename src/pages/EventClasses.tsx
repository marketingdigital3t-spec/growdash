import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CalendarDays, Users, Stethoscope, AlertTriangle, CheckCircle2, Clock3, MapPin } from "lucide-react";
import { useEventClasses, type EventClassStatus, type EventClassWithCounts } from "@/hooks/useEventClasses";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { EventClassCard } from "@/components/event-classes/EventClassCard";
import { EventClassFormDialog } from "@/components/event-classes/EventClassFormDialog";
import { motion } from "framer-motion";
import { parseISO, isAfter, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "open", label: "Aberta" },
  { value: "sold_out", label: "Esgotada" },
  { value: "upcoming", label: "Em breve" },
  { value: "cancelled", label: "Cancelada" },
  { value: "finished", label: "Finalizada" },
];

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent || "bg-primary/10 text-primary"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EventClasses() {
  const { data: classes, isLoading } = useEventClasses();
  const { data: funnels } = useRDFunnels();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [funnelFilter, setFunnelFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [activeView, setActiveView] = useState<"classes" | "agenda">("classes");

  const filtered = useMemo(() => {
    const list = classes || [];
    return list
      .filter((c) => statusFilter === "all" || c.status === statusFilter)
      .filter((c) => funnelFilter === "all" || c.rd_funnel_id === funnelFilter)
      .filter((c) => {
        if (!query.trim()) return true;
        const ql = query.toLowerCase();
        return c.title.toLowerCase().includes(ql)
          || (c.location || "").toLowerCase().includes(ql)
          || (c.rd_funnel_name || "").toLowerCase().includes(ql);
      })
      .sort((a, b) => {
        // priorização operacional
        const score = (c: typeof a) => {
          if (c.status === "cancelled") return 7;
          if (c.status === "finished") return 6;
          if (c.status === "sold_out") return 5;
        const days = differenceInDays(parseISO(c.date_start), new Date());
          if (days < 0) return 4;
          const cap = c.max_people || c.max_students || 0;
          const pct = cap > 0 ? c.studentCount / cap : 1;
          if (days <= 14 && pct < 0.5) return 0;
          if (pct < 1) return 1;
          return 2;
        };
        const sa = score(a), sb = score(b);
        if (sa !== sb) return sa - sb;
        return a.date_start.localeCompare(b.date_start);
      });
  }, [classes, query, statusFilter, funnelFilter]);

  const summary = useMemo(() => {
    const list = filtered;
    const totalStudents = list.reduce((s, c) => s + c.studentCount, 0);
    const totalPatients = list.reduce((s, c) => s + (c.has_model_patients ? c.modelPatientCount : 0), 0);
    const capPeople = list.reduce((s, c) => s + (c.max_people || c.max_students || 0), 0);
    const open = list.filter((c) => c.status === "open").length;
    const soldOut = list.filter((c) => c.status === "sold_out").length;
    const critical = list.filter((c) => {
      if (c.status === "finished" || c.status === "cancelled") return false;
      const days = differenceInDays(parseISO(c.date_start), new Date());
      const cap = c.max_people || c.max_students || 0;
      const pct = cap > 0 ? c.studentCount / cap : 1;
      return days >= 0 && days <= 14 && pct < 0.5;
    }).length;
    return {
      total: list.length,
      open,
      soldOut,
      students: totalStudents,
      patients: totalPatients,
      vacancies: Math.max(capPeople - totalStudents, 0),
      critical,
    };
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      <nav className="grid max-w-md grid-cols-2 rounded-xl border border-border bg-muted/60 p-1" aria-label="Visualização de datas e turmas">
        <button onClick={() => setActiveView("classes")} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition ${activeView === "classes" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><CalendarDays className="h-4 w-4" />Datas & Turmas</button>
        <button onClick={() => setActiveView("agenda")} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition ${activeView === "agenda" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Clock3 className="h-4 w-4" />Agenda</button>
      </nav>

      {activeView === "classes" ? <>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" /> Datas & Turmas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie turmas, vagas, alunos e pacientes-modelo vinculados aos funis comerciais do RD Station.
            </p>
          </div>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova turma
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard icon={CalendarDays} label="Turmas" value={summary.total} />
        <StatCard icon={CheckCircle2} label="Abertas" value={summary.open} accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={CheckCircle2} label="Esgotadas" value={summary.soldOut} accent="bg-muted text-muted-foreground" />
        <StatCard icon={Users} label="Pessoas" value={summary.students} />
        <StatCard icon={Stethoscope} label="Pacientes" value={summary.patients} />
        <StatCard icon={Users} label="Vagas disp." value={summary.vacancies} />
        <StatCard icon={AlertTriangle} label="Críticas" value={summary.critical} accent="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar turma por nome, local ou funil..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={funnelFilter} onValueChange={setFunnelFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Funil RD" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis</SelectItem>
            {(funnels || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-sm text-muted-foreground">Carregando turmas...</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-2">
            <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-medium">Nenhuma turma cadastrada ainda</h3>
            <p className="text-sm text-muted-foreground">Crie a primeira turma e vincule a um funil do RD Station.</p>
            <Button onClick={() => setFormOpen(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" /> Nova turma
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((ec) => (
          <EventClassCard key={ec.id} ec={ec} />
        ))}
      </div>
      </> : <AgendaPanel classes={filtered} isLoading={isLoading} onCreate={() => setFormOpen(true)} />}

      <EventClassFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function AgendaPanel({ classes, isLoading, onCreate }: { classes: EventClassWithCounts[]; isLoading: boolean; onCreate: () => void }) {
  const upcoming = classes
    .filter((eventClass) => eventClass.status !== "cancelled" && eventClass.status !== "finished")
    .filter((eventClass) => isAfter(parseISO(eventClass.date_end || eventClass.date_start), new Date()) || differenceInDays(parseISO(eventClass.date_start), new Date()) === 0)
    .sort((a, b) => a.date_start.localeCompare(b.date_start));

  return <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><Clock3 className="h-6 w-6 text-primary" />Agenda de turmas</h1><p className="mt-1 text-sm text-muted-foreground">Próximos encontros, capacidade e origem comercial em ordem cronológica.</p></div><Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Nova turma</Button></header>
    {isLoading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Carregando agenda…</CardContent></Card> : upcoming.length === 0 ? <Card><CardContent className="py-16 text-center"><CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" /><h3 className="mt-3 font-medium">Nenhum evento futuro na agenda</h3><p className="mt-1 text-sm text-muted-foreground">Cadastre uma turma com data futura para começar o planejamento.</p><Button onClick={onCreate} className="mt-5"><Plus className="mr-2 h-4 w-4" />Nova turma</Button></CardContent></Card> : <div className="space-y-3">{upcoming.map((eventClass) => {
      const peopleCap = eventClass.max_people || eventClass.max_students || 0;
      const vacancies = Math.max(peopleCap - eventClass.studentCount, 0);
      return <article key={eventClass.id} className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-[140px_minmax(0,1fr)_auto]">
        <div className="flex flex-row items-center gap-3 border-b border-border bg-primary/[0.04] p-4 sm:flex-col sm:items-start sm:justify-center sm:border-b-0 sm:border-r"><span className="text-2xl font-black text-primary">{format(parseISO(eventClass.date_start), "dd")}</span><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{format(parseISO(eventClass.date_start), "MMM yyyy", { locale: ptBR })}</span></div>
        <div className="p-4"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{eventClass.title}</h2><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{eventClass.status === "sold_out" ? "Esgotada" : eventClass.status === "upcoming" ? "Em breve" : "Aberta"}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{format(parseISO(eventClass.date_start), "HH:mm")}{eventClass.date_end ? `–${format(parseISO(eventClass.date_end), "HH:mm")}` : ""}</span>{eventClass.location && <span><MapPin className="mr-1 inline h-3.5 w-3.5" />{eventClass.location}</span>}{eventClass.rd_funnel_name && <span>Funil: {eventClass.rd_funnel_name}</span>}</div></div>
        <div className="flex items-center gap-5 border-t border-border px-4 py-3 sm:border-l sm:border-t-0"><div className="text-right"><span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground">Ocupação</span><strong className="text-sm">{eventClass.studentCount}/{peopleCap}</strong></div><div className="text-right"><span className="block text-[9px] font-black uppercase tracking-wider text-muted-foreground">Vagas</span><strong className="text-sm text-primary">{vacancies}</strong></div></div>
      </article>;
    })}</div>}
  </motion.section>;
}
