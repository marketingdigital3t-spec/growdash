import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { data: "04/07/2026", paciente: "Ana Beatriz Souza", tipo: "Atestado", descricao: "Repouso 2 dias" },
  { data: "02/07/2026", paciente: "Camila Oliveira", tipo: "Prescrição", descricao: "Pomada cicatrizante" },
  { data: "28/06/2026", paciente: "Juliana Ramos", tipo: "Prescrição", descricao: "Anti-inflamatório 7 dias" },
];

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
        rows={rows}
        columns={[
          { key: "data", label: "Data" },
          { key: "paciente", label: "Paciente" },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone={r.tipo === "Atestado" ? "primary" : "pink"}>{r.tipo}</Badge> },
          { key: "descricao", label: "Descrição" },
          { key: "acao", label: "", render: () => <Button variant="secondary"><FileText className="h-4 w-4" /> PDF</Button> },
        ]}
      />
    </div>
  );
}
