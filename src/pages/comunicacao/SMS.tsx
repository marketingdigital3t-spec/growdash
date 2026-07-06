import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";
import { Plus } from "lucide-react";

const rows = [
  { data: "05/07 09:00", dest: "(11) 98812-4432", msg: "Lembrete: seu horário é amanhã 14h.", status: "Entregue" },
  { data: "04/07 08:00", dest: "(11) 99911-2210", msg: "Confirma sua sessão hoje 16h? Responda SIM.", status: "Entregue" },
  { data: "03/07 08:00", dest: "(21) 98230-5544", msg: "Sua guia foi autorizada 🎉", status: "Falha" },
];
const tone: Record<string, "green" | "red"> = { Entregue: "green", Falha: "red" };

export default function SMS() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunicação", "SMS"]}
        title="SMS"
        actions={<Button><Plus className="h-4 w-4" /> Novo envio</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Enviados mês" value="342" accent="primary" />
        <StatCard label="Créditos restantes" value="1.208" accent="green" />
        <StatCard label="Taxa entrega" value="98%" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "data", label: "Envio" },
          { key: "dest", label: "Destinatária" },
          { key: "msg", label: "Mensagem" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
