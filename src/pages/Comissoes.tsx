import { PageHeader, StatCard } from "@/components/page-primitives";
import { DataTable, Badge } from "@/components/list-primitives";

const rows = [
  { prof: "Dra. Renata Alves", atend: 84, receita: "R$ 42.180", pct: "30%", comissao: "R$ 12.654" },
  { prof: "Dra. Paula Menezes", atend: 52, receita: "R$ 28.400", pct: "30%", comissao: "R$ 8.520" },
  { prof: "Enf. Carla Duarte", atend: 48, receita: "R$ 13.740", pct: "15%", comissao: "R$ 2.061" },
];

export default function Comissoes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comissões"]}
        title="Comissões"
        subtitle="Cálculo automático por profissional no período selecionado."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Comissão total mês" value="R$ 23.235" accent="primary" />
        <StatCard label="Atendimentos" value="184" accent="green" />
        <StatCard label="Receita gerada" value="R$ 84.320" accent="pink" />
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "prof", label: "Profissional" },
          { key: "atend", label: "Atendimentos" },
          { key: "receita", label: "Receita" },
          { key: "pct", label: "%", render: (r) => <Badge tone="primary">{r.pct}</Badge> },
          { key: "comissao", label: "Comissão" },
        ]}
      />
    </div>
  );
}
