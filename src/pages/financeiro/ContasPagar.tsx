import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function ContasPagar() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Contas a pagar"]}
        title="Contas a pagar"
        actions={<Button><Plus className="h-4 w-4" /> Nova conta</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Vence hoje" value="R$ 0,00" accent="primary" />
        <StatCard label="Vence essa semana" value="R$ 0,00" accent="yellow" />
        <StatCard label="Pago no mês" value="R$ 0,00" accent="green" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ venc: string; desc: string; cat: string; valor: string; status: string }>}
        empty="Nenhuma conta cadastrada."
        columns={[
          { key: "venc", label: "Vencimento" },
          { key: "desc", label: "Descrição" },
          { key: "cat", label: "Categoria" },
          { key: "valor", label: "Valor" },
          { key: "status", label: "Status", render: (r) => <Badge tone="yellow">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
