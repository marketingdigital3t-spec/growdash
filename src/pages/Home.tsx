import { useMemo, useState } from "react";
import {
  Calendar,
  DollarSign,
  UserPlus,
  Users,
  ArrowUpRight,
  Plus,
  ChevronRight,
} from "lucide-react";
import { PageHeader, StatCard, Button, Badge } from "@/components/page-primitives";
import { Link, useNavigate } from "react-router-dom";
import NewAppointmentDialog from "@/components/NewAppointmentDialog";
import { useClinic, todayISO } from "@/store/clinic-store";

export default function Home() {
  const navigate = useNavigate();
  const { appointments } = useClinic();
  const [open, setOpen] = useState(false);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const today = todayISO();
  const todays = useMemo(
    () => appointments.filter((a) => a.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, today],
  );
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.date >= today && a.status !== "cancelado")
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 6),
    [appointments, today],
  );

  const revenueToday = todays
    .filter((a) => a.status !== "cancelado")
    .reduce((sum, a) => sum + (a.value || 0), 0);
  const patients = new Set(appointments.map((a) => a.patient.trim().toLowerCase()).filter(Boolean)).size;

  const statusTone = {
    confirmado: "green",
    aguardando: "yellow",
    realizado: "primary",
    cancelado: "red",
  } as const;

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Início"]}
        title={`${greeting}, seja bem-vinda`}
        subtitle="Comece criando seu primeiro agendamento ou cadastro."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/agenda/semana")}>
              <Calendar className="h-4 w-4" /> Ver agenda
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Agendamentos hoje"
          value={String(todays.length)}
          hint={todays.length ? "Confira a agenda" : "Nenhum agendado"}
          accent="primary"
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          label="Faturamento do dia"
          value={`R$ ${revenueToday.toLocaleString("pt-BR")}`}
          hint={revenueToday ? "Somatório dos atendimentos" : "Sem lançamentos"}
          accent="green"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="Novos pacientes"
          value={String(patients)}
          hint={patients ? "Únicos no total" : "Cadastre para começar"}
          accent="pink"
          icon={<UserPlus className="h-5 w-5" />}
        />
        <StatCard
          label="Pacientes ativos"
          value={String(patients)}
          hint={patients ? "Com pelo menos 1 atendimento" : "Nenhum cadastrado"}
          accent="yellow"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Próximos atendimentos */}
        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Próximos atendimentos</h2>
            <Link to="/agenda/semana" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              Ver todos <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState text="Nenhum atendimento por aqui. Crie um novo agendamento para começar." />
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {upcoming.map((u) => (
                <li key={u.id} className="flex items-center gap-4 py-3">
                  <div className="flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <span className="text-sm font-extrabold">{u.time}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-foreground">{u.patient}</div>
                    <div className="truncate text-xs font-semibold text-muted-foreground">{u.proc}</div>
                  </div>
                  <Badge tone={statusTone[u.status]}>{u.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Atividade recente */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Atividade recente</h2>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <EmptyState text="Sem atividades ainda." />
        </div>
      </div>

      {/* Atalhos */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Shortcut to="/contatos/pacientes" title="Cadastrar paciente" desc="Adicione uma nova paciente com anexos e histórico." />
        <Shortcut to="/clinidocs/documentos" title="Anexar contrato" desc="Envie um termo ou contrato à ficha da paciente." />
        <Shortcut to="/comunicacao/whatsapp" title="Abrir chat" desc="Converse pelo canal interno seguro conforme LGPD." />
      </div>

      <NewAppointmentDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center text-sm font-semibold text-muted-foreground">
      {text}
    </div>
  );
}

function Shortcut({ to, title, desc }: { to: string; title: string; desc: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_20px_40px_-24px_hsl(var(--primary)/0.4)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowUpRight className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-extrabold text-foreground">{title}</div>
        <p className="text-xs font-semibold text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}
