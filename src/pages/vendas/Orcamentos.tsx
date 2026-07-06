import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { num: "ORC-0142", paciente: "Marina Prado", valor: "R$ 4.200,00", validade: "20/07/2026", status: "Aberto" },
  { num: "ORC-0141", paciente: "Sabrina Costa", valor: "R$ 1.800,00", validade: "18/07/2026", status: "Aceito" },
  { num: "ORC-0140", paciente: "Vanessa Rocha", valor: "R$ 6.400,00", validade: "10/07/2026", status: "Expirado" },
];
const tone: Record<string, "primary" | "green" | "neutral"> = { Aberto: "primary", Aceito: "green", Expirado: "neutral" };

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
        rows={rows}
        columns={[
          { key: "num", label: "Nº" },
          { key: "paciente", label: "Paciente" },
          { key: "valor", label: "Valor" },
          { key: "validade", label: "Validade" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
