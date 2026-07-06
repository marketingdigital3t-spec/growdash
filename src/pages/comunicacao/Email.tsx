import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Email() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunicação", "E-mail"]}
        title="E-mail"
        actions={<Button><Plus className="h-4 w-4" /> Nova campanha</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Enviados mês" value="0" accent="primary" />
        <StatCard label="Abertura" value="0%" accent="green" />
        <StatCard label="Cliques" value="0%" accent="pink" />
        <StatCard label="Falhas" value="0%" accent="yellow" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; assunto: string; dest: string; status: string }>}
        empty="Nenhum e-mail enviado."
        columns={[
          { key: "data", label: "Data" },
          { key: "assunto", label: "Assunto" },
          { key: "dest", label: "Destinatária" },
          { key: "status", label: "Status", render: (r) => <Badge tone="green">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
