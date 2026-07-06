import { Plus, Download, Filter } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Pacientes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Pacientes"]}
        title="Pacientes"
        subtitle="Gestão completa de todas as pacientes da clínica."
        actions={<>
          <Button variant="secondary"><Download className="h-4 w-4" /> Exportar</Button>
          <Button><Plus className="h-4 w-4" /> Nova paciente</Button>
        </>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value="0" hint="cadastradas" accent="primary" />
        <StatCard label="Ativas" value="0" hint="atendidas nos últimos 90 dias" accent="green" />
        <StatCard label="Novas no mês" value="0" accent="pink" />
        <StatCard label="Aniversariantes" value="0" hint="nesta semana" accent="yellow" />
      </div>
      <Toolbar searchPlaceholder="Buscar por nome, telefone ou e-mail...">
        <Button variant="secondary"><Filter className="h-4 w-4" /> Filtros</Button>
      </Toolbar>
      <DataTable
        rows={[] as Array<{ nome: string; tel: string; email: string; ultima: string; status: string }>}
        empty="Nenhuma paciente cadastrada ainda."
        columns={[
          { key: "nome", label: "Nome" },
          { key: "tel", label: "Telefone" },
          { key: "email", label: "E-mail" },
          { key: "ultima", label: "Último atendimento" },
          { key: "status", label: "Status", render: (r) => <Badge tone="green">{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
