import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { nome: "Beauty Supply BR", cat: "Cosméticos", cnpj: "12.345.678/0001-90", tel: "(11) 4002-0011", status: "Ativo" },
  { nome: "MedFarma Insumos", cat: "Medicamentos", cnpj: "22.987.654/0001-33", tel: "(11) 4002-2299", status: "Ativo" },
  { nome: "EquipEstética", cat: "Equipamentos", cnpj: "45.111.222/0001-15", tel: "(11) 4002-9988", status: "Inativo" },
];

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
        rows={rows}
        columns={[
          { key: "nome", label: "Fornecedor" },
          { key: "cat", label: "Categoria" },
          { key: "cnpj", label: "CNPJ" },
          { key: "tel", label: "Contato" },
          { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Ativo" ? "green" : "neutral"}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
