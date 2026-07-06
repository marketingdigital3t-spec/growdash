import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Badge } from "@/components/list-primitives";

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
        rows={[] as Array<{ nome: string; tipo: string; tel: string }>}
        empty="Nenhum contato cadastrado."
        columns={[
          { key: "nome", label: "Nome" },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone="primary">{r.tipo}</Badge> },
          { key: "tel", label: "Telefone" },
        ]}
      />
    </div>
  );
}
