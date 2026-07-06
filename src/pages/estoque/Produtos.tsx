import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { cod: "P-001", nome: "Gel anestésico tópico 60g", cat: "Insumo", estoque: 24, min: 10, preco: "R$ 45,00" },
  { cod: "P-002", nome: "Ácido hialurônico 1ml", cat: "Injetável", estoque: 6, min: 8, preco: "R$ 380,00" },
  { cod: "P-003", nome: "Máscara pós-laser", cat: "Cosmético", estoque: 42, min: 15, preco: "R$ 28,00" },
  { cod: "P-004", nome: "Luva nitrílica cx100", cat: "EPI", estoque: 3, min: 5, preco: "R$ 68,00" },
];

export default function Produtos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Estoque", "Produtos"]}
        title="Produtos"
        actions={<Button><Plus className="h-4 w-4" /> Novo produto</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="SKUs ativos" value="86" accent="primary" />
        <StatCard label="Abaixo do mínimo" value="7" accent="yellow" />
        <StatCard label="Valor em estoque" value="R$ 28.940" accent="green" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "cod", label: "Código" },
          { key: "nome", label: "Produto" },
          { key: "cat", label: "Categoria" },
          { key: "estoque", label: "Estoque", render: (r) => <Badge tone={r.estoque < r.min ? "yellow" : "green"}>{r.estoque}</Badge> },
          { key: "min", label: "Mínimo" },
          { key: "preco", label: "Preço" },
        ]}
      />
    </div>
  );
}
