import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function SMS() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunicação", "SMS"]}
        title="SMS"
        actions={<Button><Plus className="h-4 w-4" /> Novo envio</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Enviados mês" value="0" accent="primary" />
        <StatCard label="Créditos restantes" value="0" accent="green" />
        <StatCard label="Taxa entrega" value="0%" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; dest: string; msg: string; status: string }>}
        empty="Nenhum SMS enviado."
        columns={[
          { key: "data", label: "Envio" },
          { key: "dest", label: "Destinatária" },
          { key: "msg", label: "Mensagem" },
          { key: "status", label: "Status", render: (r) => <Badge tone="green">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
