import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { venc: "08/07/2026", desc: "Aluguel da sala", cat: "Fixas", valor: "R$ 6.800,00", status: "A pagar" },
  { venc: "10/07/2026", desc: "Insumos Beauty Supply", cat: "Insumos", valor: "R$ 2.340,00", status: "A pagar" },
  { venc: "12/07/2026", desc: "Salário Enf. Carla", cat: "Folha", valor: "R$ 4.500,00", status: "A pagar" },
  { venc: "02/07/2026", desc: "Energia elétrica", cat: "Utilidades", valor: "R$ 780,00", status: "Pago" },
];
const tone: Record<string, "yellow" | "green"> = { "A pagar": "yellow", Pago: "green" };

export default function ContasPagar() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Contas a pagar"]}
        title="Contas a pagar"
        actions={<Button><Plus className="h-4 w-4" /> Nova conta</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Vence hoje" value="R$ 0" accent="primary" />
        <StatCard label="Vence essa semana" value="R$ 13.640" accent="yellow" />
        <StatCard label="Pago no mês" value="R$ 21.480" accent="green" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "venc", label: "Vencimento" },
          { key: "desc", label: "Descrição" },
          { key: "cat", label: "Categoria" },
          { key: "valor", label: "Valor" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
