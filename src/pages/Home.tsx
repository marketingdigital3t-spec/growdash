import { useState } from "react";
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
import { Link } from "react-router-dom";

const upcoming: { time: string; patient: string; proc: string; status: "confirmado" | "aguardando" | "novo" }[] = [];

const activities: { who: string; what: string; when: string }[] = [];

const statusTone = {
  confirmado: "green" as const,
  aguardando: "yellow" as const,
  novo: "primary" as const,
};

export default function Home() {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  });

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Início"]}
        title={`${greeting}, seja bem-vinda`}
        subtitle="Comece criando seu primeiro agendamento ou cadastro."
        actions={
          <>
            <Button variant="secondary">
              <Calendar className="h-4 w-4" /> Ver agenda
            </Button>
            <Button>
              <Plus className="h-4 w-4" /> Novo agendamento
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Agendamentos hoje" value="0" hint="Nenhum agendado" accent="primary" icon={<Calendar className="h-5 w-5" />} />
        <StatCard label="Faturamento do dia" value="R$ 0" hint="Sem lançamentos" accent="green" icon={<DollarSign className="h-5 w-5" />} />
        <StatCard label="Novos pacientes" value="0" hint="Cadastre para começar" accent="pink" icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Pacientes ativos" value="0" hint="Nenhum cadastrado" accent="yellow" icon={<Users className="h-5 w-5" />} />
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
          <ul className="flex flex-col divide-y divide-border">
            {upcoming.map((u) => (
              <li key={u.time} className="flex items-center gap-4 py-3">
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
        </div>

        {/* Atividade recente */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-foreground">Atividade recente</h2>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <ul className="flex flex-col gap-3">
            {activities.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-extrabold">{a.who}</span>{" "}
                    <span className="text-foreground/70">{a.what}</span>
                  </p>
                  <p className="text-xs font-semibold text-muted-foreground">{a.when}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Atalhos */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Shortcut to="/contatos/pacientes" title="Cadastrar paciente" desc="Adicione uma nova paciente com anexos e histórico." />
        <Shortcut to="/clinidocs/documentos" title="Anexar contrato" desc="Envie um termo ou contrato à ficha da paciente." />
        <Shortcut to="/comunicacao/whatsapp" title="Abrir chat" desc="Converse pelo canal interno seguro conforme LGPD." />
      </div>
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
