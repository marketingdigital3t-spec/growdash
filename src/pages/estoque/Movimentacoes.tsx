import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Badge } from "@/components/list-primitives";

export default function Movimentacoes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Estoque", "Movimentações"]}
        title="Movimentações"
        subtitle="Entradas e saídas de estoque com rastreabilidade."
      />
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; produto: string; tipo: string; qtd: number; motivo: string }>}
        empty="Nenhuma movimentação registrada."
        columns={[
          { key: "data", label: "Data" },
          { key: "produto", label: "Produto" },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone={r.tipo === "Entrada" ? "green" : "pink"}>{r.tipo}</Badge> },
          { key: "qtd", label: "Qtd" },
          { key: "motivo", label: "Motivo" },
        ]}
      />
    </div>
  );
}
