import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { data: "05/07/2026", paciente: "Ana Beatriz Souza", tipo: "Termo LGPD", assinado: true },
  { data: "04/07/2026", paciente: "Camila Oliveira", tipo: "Consentimento Laser", assinado: true },
  { data: "03/07/2026", paciente: "Juliana Ramos", tipo: "Anamnese", assinado: false },
];

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
        rows={rows}
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "tipo", label: "Tipo" },
          { key: "assinado", label: "Assinado", render: (r) => <Badge tone={r.assinado ? "green" : "yellow"}>{r.assinado ? "Sim" : "Pendente"}</Badge> },
          { key: "acao", label: "", render: () => <Button variant="secondary"><FileText className="h-4 w-4" /> Ver</Button> },
        ]}
      />
    </div>
  );
}
