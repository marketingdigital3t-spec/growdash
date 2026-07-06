import { PageHeader, StatCard } from "@/components/page-primitives";
import { DataTable, Badge } from "@/components/list-primitives";

export default function Frequencia() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Frequência"]}
        title="Frequência de pacientes"
        subtitle="Identifique quem está engajada e quem precisa de reengajamento."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Fiéis (10+ visitas)" value="0" accent="green" />
        <StatCard label="Recorrentes" value="0" accent="primary" />
        <StatCard label="Em risco (sem retorno)" value="0" accent="yellow" />
      </div>
      <DataTable
        rows={[] as Array<{ nome: string; visitas: number; ultima: string; nivel: string }>}
        empty="Sem dados de frequência ainda."
        columns={[
          { key: "nome", label: "Paciente" },
          { key: "visitas", label: "Visitas" },
          { key: "ultima", label: "Última visita" },
          { key: "nivel", label: "Classificação", render: (r) => <Badge tone="primary">{r.nivel}</Badge> },
        ]}
      />
    </div>
  );
}
