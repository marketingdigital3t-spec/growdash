import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Documentos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "CliniDocs", "Documentos"]}
        title="Documentos emitidos"
        actions={<Button><Plus className="h-4 w-4" /> Novo documento</Button>}
      />
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; paciente: string; tipo: string; assinado: boolean }>}
        empty="Nenhum documento emitido."
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "tipo", label: "Tipo" },
          { key: "assinado", label: "Assinado", render: (r) => <Badge tone={r.assinado ? "green" : "yellow"}>{r.assinado ? "Sim" : "Pendente"}</Badge> },
        ]}
      />
    </div>
  );
}
