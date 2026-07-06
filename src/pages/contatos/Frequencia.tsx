import { PageHeader, StatCard } from "@/components/page-primitives";
import { DataTable, Badge } from "@/components/list-primitives";

const rows = [
  { nome: "Ana Beatriz Souza", visitas: 12, ultima: "02/07/2026", nivel: "Fiel" },
  { nome: "Camila Oliveira", visitas: 8, ultima: "28/06/2026", nivel: "Recorrente" },
  { nome: "Juliana Ramos", visitas: 5, ultima: "10/06/2026", nivel: "Recorrente" },
  { nome: "Fernanda Lima", visitas: 2, ultima: "15/05/2026", nivel: "Risco" },
];

const tone: Record<string, "green" | "primary" | "yellow"> = { Fiel: "green", Recorrente: "primary", Risco: "yellow" };

export default function Frequencia() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Frequência"]}
        title="Frequência de pacientes"
        subtitle="Identifique quem está engajada e quem precisa de reengajamento."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Fiéis (10+ visitas)" value="34" accent="green" />
        <StatCard label="Recorrentes" value="121" accent="primary" />
        <StatCard label="Em risco (sem retorno)" value="27" accent="yellow" />
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: "nome", label: "Paciente" },
          { key: "visitas", label: "Visitas" },
          { key: "ultima", label: "Última visita" },
          { key: "nivel", label: "Classificação", render: (r) => <Badge tone={tone[r.nivel]}>{r.nivel}</Badge> },
        ]}
      />
    </div>
  );
}
