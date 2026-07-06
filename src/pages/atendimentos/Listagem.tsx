import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { data: "05/07/2026", paciente: "Ana Beatriz Souza", prof: "Dra. Renata", proc: "Clareamento íntimo", status: "Realizado" },
  { data: "05/07/2026", paciente: "Camila Oliveira", prof: "Dra. Paula", proc: "Avaliação", status: "Realizado" },
  { data: "06/07/2026", paciente: "Juliana Ramos", prof: "Dra. Renata", proc: "Laser CO2", status: "Confirmado" },
  { data: "06/07/2026", paciente: "Débora Martins", prof: "Enf. Carla", proc: "Retorno", status: "Aguardando" },
];
const tone: Record<string, "green" | "primary" | "yellow"> = { Realizado: "green", Confirmado: "primary", Aguardando: "yellow" };

export default function AtendimentosListagem() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Atendimentos", "Listagem"]}
        title="Atendimentos"
        subtitle="Todos os atendimentos registrados na clínica."
        actions={<Button><Plus className="h-4 w-4" /> Novo atendimento</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Hoje" value="8" accent="primary" />
        <StatCard label="Semana" value="42" accent="pink" />
        <StatCard label="Mês" value="184" accent="green" />
        <StatCard label="Receita mês" value="R$ 62.480" accent="yellow" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "prof", label: "Profissional" },
          { key: "proc", label: "Procedimento" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
