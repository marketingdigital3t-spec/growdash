import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { data: "05/07/2026", paciente: "Ana Beatriz Souza", item: "Pacote 5 sessões laser", valor: "R$ 3.500,00", pgto: "Cartão 6x", status: "Pago" },
  { data: "04/07/2026", paciente: "Camila Oliveira", item: "Avaliação", valor: "R$ 350,00", pgto: "Pix", status: "Pago" },
  { data: "03/07/2026", paciente: "Juliana Ramos", item: "Clareamento íntimo", valor: "R$ 1.200,00", pgto: "Cartão 3x", status: "Pendente" },
];
const tone: Record<string, "green" | "yellow"> = { Pago: "green", Pendente: "yellow" };

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
        <StatCard label="Vendas mês" value="R$ 84.320" accent="green" />
        <StatCard label="Ticket médio" value="R$ 620" accent="primary" />
        <StatCard label="A receber" value="R$ 12.180" accent="yellow" />
        <StatCard label="Convertidas" value="127" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "item", label: "Item" },
          { key: "valor", label: "Valor" },
          { key: "pgto", label: "Forma" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
