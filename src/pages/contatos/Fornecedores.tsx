import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Fornecedores() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Fornecedores"]}
        title="Fornecedores"
        subtitle="Empresas parceiras de insumos e equipamentos."
        actions={<Button><Plus className="h-4 w-4" /> Novo fornecedor</Button>}
      />
      <Toolbar />
      <DataTable
        rows={[] as Array<{ nome: string; cat: string; cnpj: string; tel: string; status: string }>}
        empty="Nenhum fornecedor cadastrado."
        columns={[
          { key: "nome", label: "Fornecedor" },
          { key: "cat", label: "Categoria" },
          { key: "cnpj", label: "CNPJ" },
          { key: "tel", label: "Contato" },
          { key: "status", label: "Status", render: (r) => <Badge tone="green">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
