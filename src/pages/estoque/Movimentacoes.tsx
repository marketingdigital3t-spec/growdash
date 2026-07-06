import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Badge } from "@/components/list-primitives";

const rows = [
  { data: "05/07/2026", produto: "Gel anestésico 60g", tipo: "Saída", qtd: 2, motivo: "Atendimento Ana B." },
  { data: "04/07/2026", produto: "Ácido hialurônico 1ml", tipo: "Entrada", qtd: 12, motivo: "Compra Beauty Supply" },
  { data: "03/07/2026", produto: "Máscara pós-laser", tipo: "Saída", qtd: 4, motivo: "Atendimentos do dia" },
];

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
        rows={rows}
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
