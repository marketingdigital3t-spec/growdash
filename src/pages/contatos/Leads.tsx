import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Leads() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Leads"]}
        title="Leads"
        subtitle="Funil de novas pacientes em prospecção."
        actions={<Button><Plus className="h-4 w-4" /> Novo lead</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Novos" value="0" accent="yellow" />
        <StatCard label="Qualificação" value="0" accent="primary" />
        <StatCard label="Proposta" value="0" accent="green" />
        <StatCard label="Conversão" value="0%" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={[] as Array<{ nome: string; origem: string; interesse: string; estagio: string }>}
        empty="Nenhum lead cadastrado."
        columns={[
          { key: "nome", label: "Lead" },
          { key: "origem", label: "Origem" },
          { key: "interesse", label: "Interesse" },
          { key: "estagio", label: "Estágio", render: (r) => <Badge tone="primary">{r.estagio}</Badge> },
        ]}
      />
    </div>
  );
}
