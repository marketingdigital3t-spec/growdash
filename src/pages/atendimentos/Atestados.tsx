import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Atestados() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Atendimentos", "Atestados e prescrições"]}
        title="Atestados e prescrições"
        subtitle="Emita documentos clínicos com assinatura digital."
        actions={<Button><Plus className="h-4 w-4" /> Novo documento</Button>}
      />
      <Toolbar />
      <DataTable
        rows={[] as Array<{ data: string; paciente: string; tipo: string; descricao: string }>}
        empty="Nenhum documento emitido."
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone="primary">{r.tipo}</Badge> },
          { key: "descricao", label: "Descrição" },
        ]}
      />
    </div>
  );
}
