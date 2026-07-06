import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

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
        <StatCard label="Hoje" value="0" accent="primary" />
        <StatCard label="Semana" value="0" accent="pink" />
        <StatCard label="Mês" value="0" accent="green" />
        <StatCard label="Receita mês" value="R$ 0,00" accent="yellow" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; paciente: string; prof: string; proc: string; status: string }>}
        empty="Nenhum atendimento registrado."
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "prof", label: "Profissional" },
          { key: "proc", label: "Procedimento" },
          { key: "status", label: "Status", render: (r) => <Badge tone="primary">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
