import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { nome: "Dra. Renata Alves", esp: "Ginecologia estética", conselho: "CRM 123.456", agenda: "Seg–Sex", status: "Ativa" },
  { nome: "Dra. Paula Menezes", esp: "Dermatologia íntima", conselho: "CRM 234.567", agenda: "Ter e Qui", status: "Ativa" },
  { nome: "Enf. Carla Duarte", esp: "Enfermagem estética", conselho: "COREN 45.678", agenda: "Seg–Sáb", status: "Ativa" },
];

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
        <StatCard label="Profissionais ativos" value="3" accent="primary" />
        <StatCard label="Atendimentos no mês" value="184" accent="green" />
        <StatCard label="Ocupação média" value="78%" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
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
