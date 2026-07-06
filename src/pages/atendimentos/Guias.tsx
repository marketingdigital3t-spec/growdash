import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Guias() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Atendimentos", "Guias SP/SADT"]}
        title="Guias SP/SADT"
        subtitle="Guias de convênio e status de autorização."
        actions={<Button><Plus className="h-4 w-4" /> Nova guia</Button>}
      />
      <Toolbar />
      <DataTable
        rows={[] as Array<{ numero: string; paciente: string; convenio: string; status: string }>}
        empty="Nenhuma guia emitida."
        columns={[
          { key: "numero", label: "Nº guia" },
          { key: "paciente", label: "Paciente" },
          { key: "convenio", label: "Convênio" },
          { key: "status", label: "Status", render: (r) => <Badge tone="primary">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
