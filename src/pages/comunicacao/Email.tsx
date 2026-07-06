import { Plus, Send } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { data: "05/07/2026", assunto: "Confirmação de agendamento", dest: "Ana B. Souza", status: "Entregue" },
  { data: "04/07/2026", assunto: "Boas-vindas — Cuidados pós-laser", dest: "Camila Oliveira", status: "Entregue" },
  { data: "03/07/2026", assunto: "Aniversário 🎂", dest: "Juliana Ramos", status: "Aberto" },
  { data: "02/07/2026", assunto: "Cobrança amigável", dest: "Fernanda Lima", status: "Falha" },
];
const tone: Record<string, "green" | "primary" | "red"> = { Entregue: "green", Aberto: "primary", Falha: "red" };

export default function Email() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunicação", "E-mail"]}
        title="E-mail"
        actions={<Button><Plus className="h-4 w-4" /> Nova campanha</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Enviados mês" value="1.284" accent="primary" />
        <StatCard label="Abertura" value="62%" accent="green" />
        <StatCard label="Cliques" value="18%" accent="pink" />
        <StatCard label="Falhas" value="0,4%" accent="yellow" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "data", label: "Data" },
          { key: "assunto", label: "Assunto" },
          { key: "dest", label: "Destinatária" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
          { key: "acao", label: "", render: () => <Button variant="ghost"><Send className="h-4 w-4" /></Button> },
        ]}
      />
    </div>
  );
}
