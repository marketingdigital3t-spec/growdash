import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Orcamentos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Vendas", "Orçamentos"]}
        title="Orçamentos"
        subtitle="Propostas enviadas para pacientes e leads."
        actions={<Button><Plus className="h-4 w-4" /> Novo orçamento</Button>}
      />
      <Toolbar />
      <DataTable
        rows={[] as Array<{ num: string; paciente: string; valor: string; validade: string; status: string }>}
        empty="Nenhum orçamento emitido."
        columns={[
          { key: "num", label: "Nº" },
          { key: "paciente", label: "Paciente" },
          { key: "valor", label: "Valor" },
          { key: "validade", label: "Validade" },
          { key: "status", label: "Status", render: (r) => <Badge tone="primary">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
