import { PageHeader, StatCard } from "@/components/page-primitives";
import { DataTable, Badge } from "@/components/list-primitives";

export default function Comissoes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comissões"]}
        title="Comissões"
        subtitle="Cálculo automático por profissional no período selecionado."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Comissão total mês" value="R$ 0,00" accent="primary" />
        <StatCard label="Atendimentos" value="0" accent="green" />
        <StatCard label="Receita gerada" value="R$ 0,00" accent="pink" />
      </div>
      <DataTable
        rows={[] as Array<{ prof: string; atend: number; receita: string; pct: string; comissao: string }>}
        empty="Nenhum profissional com comissão calculada."
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
