import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Produtos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Estoque", "Produtos"]}
        title="Produtos"
        actions={<Button><Plus className="h-4 w-4" /> Novo produto</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="SKUs ativos" value="0" accent="primary" />
        <StatCard label="Abaixo do mínimo" value="0" accent="yellow" />
        <StatCard label="Valor em estoque" value="R$ 0,00" accent="green" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ cod: string; nome: string; cat: string; estoque: number; min: number; preco: string }>}
        empty="Nenhum produto cadastrado."
        columns={[
          { key: "cod", label: "Código" },
          { key: "nome", label: "Produto" },
          { key: "cat", label: "Categoria" },
          { key: "estoque", label: "Estoque", render: (r) => <Badge tone="green">{r.estoque}</Badge> },
          { key: "min", label: "Mínimo" },
          { key: "preco", label: "Preço" },
        ]}
      />
    </div>
  );
}
