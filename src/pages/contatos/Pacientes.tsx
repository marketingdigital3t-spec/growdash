import { Plus, Download, Filter } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { nome: "Ana Beatriz Souza", tel: "(11) 98812-4432", email: "ana.souza@email.com", ultima: "02/07/2026", status: "Ativa" },
  { nome: "Camila Oliveira", tel: "(11) 99911-2210", email: "camila.o@email.com", ultima: "28/06/2026", status: "Ativa" },
  { nome: "Débora Martins", tel: "(21) 98230-5544", email: "debora.m@email.com", ultima: "20/06/2026", status: "Ativa" },
  { nome: "Fernanda Lima", tel: "(11) 97744-9021", email: "fernanda.l@email.com", ultima: "15/05/2026", status: "Inativa" },
  { nome: "Juliana Ramos", tel: "(11) 98800-3300", email: "juliana.r@email.com", ultima: "10/06/2026", status: "Ativa" },
];

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
        <StatCard label="Total" value="248" hint="cadastradas" accent="primary" />
        <StatCard label="Ativas" value="212" hint="atendidas nos últimos 90 dias" accent="green" />
        <StatCard label="Novas no mês" value="18" hint="+22% vs. mês anterior" accent="pink" />
        <StatCard label="Aniversariantes" value="6" hint="nesta semana" accent="yellow" />
      </div>

      <Toolbar searchPlaceholder="Buscar por nome, telefone ou e-mail...">
        <Button variant="secondary"><Filter className="h-4 w-4" /> Filtros</Button>
      </Toolbar>

      <DataTable
        rows={rows}
        columns={[
          { key: "nome", label: "Nome" },
          { key: "tel", label: "Telefone" },
          { key: "email", label: "E-mail" },
          { key: "ultima", label: "Último atendimento" },
          { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "Ativa" ? "green" : "neutral"}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
