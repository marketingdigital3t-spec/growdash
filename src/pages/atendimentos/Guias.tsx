import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { numero: "SP 2026-0142", paciente: "Ana Beatriz Souza", convenio: "Unimed", status: "Autorizada" },
  { numero: "SP 2026-0143", paciente: "Fernanda Lima", convenio: "Bradesco", status: "Análise" },
  { numero: "SP 2026-0144", paciente: "Juliana Ramos", convenio: "Sulamérica", status: "Negada" },
];
const tone: Record<string, "green" | "yellow" | "red"> = { Autorizada: "green", Análise: "yellow", Negada: "red" };

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
        rows={rows}
        columns={[
          { key: "numero", label: "Nº guia" },
          { key: "paciente", label: "Paciente" },
          { key: "convenio", label: "Convênio" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
