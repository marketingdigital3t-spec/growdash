import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function ContasReceber() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Contas a receber"]}
        title="Contas a receber"
        actions={<Button><Plus className="h-4 w-4" /> Novo lançamento</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="A receber" value="R$ 0,00" accent="yellow" />
        <StatCard label="Recebido mês" value="R$ 0,00" accent="green" />
        <StatCard label="Em atraso" value="R$ 0,00" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ venc: string; paciente: string; desc: string; valor: string; status: string }>}
        empty="Nenhum lançamento cadastrado."
        columns={[
          { key: "venc", label: "Vencimento" },
          { key: "paciente", label: "Paciente" },
          { key: "desc", label: "Descrição" },
          { key: "valor", label: "Valor" },
          { key: "status", label: "Status", render: (r) => <Badge tone="yellow">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
