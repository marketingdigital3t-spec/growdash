import { Plus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { venc: "10/07/2026", paciente: "Juliana Ramos", desc: "Clareamento íntimo 2/3", valor: "R$ 400,00", status: "A receber" },
  { venc: "14/07/2026", paciente: "Marina Prado", desc: "Pacote laser 3/6", valor: "R$ 583,00", status: "A receber" },
  { venc: "02/07/2026", paciente: "Ana Beatriz Souza", desc: "Sessão avulsa", valor: "R$ 750,00", status: "Recebido" },
  { venc: "01/07/2026", paciente: "Fernanda Lima", desc: "Pacote 1/5", valor: "R$ 700,00", status: "Atrasado" },
];
const tone: Record<string, "yellow" | "green" | "red"> = { "A receber": "yellow", Recebido: "green", Atrasado: "red" };

export default function ContasReceber() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Contas a receber"]}
        title="Contas a receber"
        actions={<Button><Plus className="h-4 w-4" /> Novo lançamento</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="A receber" value="R$ 12.180" accent="yellow" />
        <StatCard label="Recebido mês" value="R$ 62.480" accent="green" />
        <StatCard label="Em atraso" value="R$ 2.100" accent="pink" />
      </div>
      <Toolbar />
      <DataTable
        rows={rows}
        columns={[
          { key: "venc", label: "Vencimento" },
          { key: "paciente", label: "Paciente" },
          { key: "desc", label: "Descrição" },
          { key: "valor", label: "Valor" },
          { key: "status", label: "Status", render: (r) => <Badge tone={tone[r.status]}>{r.status}</Badge> },
        ]}
      />
    </div>
  );
}
