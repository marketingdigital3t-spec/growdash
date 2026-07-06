import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Profissionais() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Profissionais"]}
        title="Profissionais"
        subtitle="Equipe clínica e seus horários de atendimento."
        actions={<Button><Plus className="h-4 w-4" /> Novo profissional</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Profissionais ativos" value="0" accent="primary" />
        <StatCard label="Atendimentos no mês" value="0" accent="green" />
        <StatCard label="Ocupação média" value="0%" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ nome: string; esp: string; conselho: string; agenda: string; status: string }>}
        empty="Nenhum profissional cadastrado."
        columns={[
          { key: "nome", label: "Profissional" },
          { key: "esp", label: "Especialidade" },
          { key: "conselho", label: "Conselho" },
          { key: "agenda", label: "Dias de atendimento" },
          { key: "status", label: "Status", render: (r) => <Badge tone="green">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
