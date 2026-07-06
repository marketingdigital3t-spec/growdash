import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Badge } from "@/components/list-primitives";

const rows = [
  { nome: "Ana Beatriz Souza", tipo: "Paciente", tel: "(11) 98812-4432" },
  { nome: "Dra. Renata Alves", tipo: "Profissional", tel: "(11) 99777-1010" },
  { nome: "Beauty Supply BR", tipo: "Fornecedor", tel: "(11) 4002-0011" },
  { nome: "Marina Prado", tipo: "Lead", tel: "(11) 98888-1122" },
];

const tone: Record<string, "primary" | "pink" | "yellow" | "green"> = {
  Paciente: "primary", Profissional: "pink", Fornecedor: "yellow", Lead: "green",
};

export default function TodosContatos() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Todos os contatos"]}
        title="Todos os contatos"
        subtitle="Base unificada de pacientes, profissionais, fornecedores e leads."
      />
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone={tone[r.tipo]}>{r.tipo}</Badge> },
          { key: "tel", label: "Telefone" },
        ]}
      />
    </div>
  );
}
