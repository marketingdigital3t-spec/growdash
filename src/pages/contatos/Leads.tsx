import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { nome: "Marina Prado", origem: "Instagram", interesse: "Ninfoplastia", estagio: "Qualificação" },
  { nome: "Sabrina Costa", origem: "Google Ads", interesse: "Clareamento íntimo", estagio: "Agendamento" },
  { nome: "Talita Nunes", origem: "Indicação", interesse: "Avaliação inicial", estagio: "Novo" },
  { nome: "Vanessa Rocha", origem: "Site", interesse: "Laser CO2", estagio: "Proposta" },
];

const tone: Record<string, "primary" | "yellow" | "green" | "pink"> = {
  Novo: "yellow",
  Qualificação: "primary",
  Agendamento: "pink",
  Proposta: "green",
};

export default function Leads() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Leads"]}
        title="Leads"
        subtitle="Funil de novas pacientes em prospecção."
        actions={<Button><Plus className="h-4 w-4" /> Novo lead</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Novos" value="14" accent="yellow" />
        <StatCard label="Qualificação" value="9" accent="primary" />
        <StatCard label="Proposta" value="5" accent="green" />
        <StatCard label="Conversão" value="42%" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "nome", label: "Lead" },
          { key: "origem", label: "Origem" },
          { key: "interesse", label: "Interesse" },
          { key: "estagio", label: "Estágio", render: (r) => <Badge tone={tone[r.estagio]}>{r.estagio}</Badge> },
        ]}
      />
    </div>
  );
}
