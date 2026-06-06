import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CalendarDays, Users, Stethoscope, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEventClasses, type EventClassStatus } from "@/hooks/useEventClasses";
import { useRDFunnels } from "@/hooks/useRDFunnels";
import { EventClassCard } from "@/components/event-classes/EventClassCard";
import { EventClassFormDialog } from "@/components/event-classes/EventClassFormDialog";
import { motion } from "framer-motion";
import { parseISO, isAfter, differenceInDays } from "date-fns";

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

      <EventClassFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
