import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function VendasLista() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Vendas", "Vendas"]}
        title="Vendas"
        subtitle="Todas as vendas e cobranças da clínica."
        actions={<Button><Plus className="h-4 w-4" /> Nova venda</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Vendas mês" value="R$ 0,00" accent="green" />
        <StatCard label="Ticket médio" value="R$ 0,00" accent="primary" />
        <StatCard label="A receber" value="R$ 0,00" accent="yellow" />
        <StatCard label="Convertidas" value="0" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; paciente: string; item: string; valor: string; pgto: string; status: string }>}
        empty="Nenhuma venda registrada."
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "item", label: "Item" },
          { key: "valor", label: "Valor" },
          { key: "pgto", label: "Forma" },
          { key: "status", label: "Status", render: (r) => <Badge tone="green">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
