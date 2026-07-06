import { ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

export default function Extrato() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Extrato"]}
        title="Extrato financeiro"
        subtitle="Movimentações de caixa detalhadas."
        actions={<Button variant="secondary"><Download className="h-4 w-4" /> Exportar CSV</Button>}
      />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Saldo atual" value="R$ 0,00" accent="primary" />
        <StatCard label="Entradas mês" value="R$ 0,00" accent="green" icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Saídas mês" value="R$ 0,00" accent="pink" icon={<ArrowDownRight className="h-4 w-4" />} />
        <StatCard label="Resultado mês" value="R$ 0,00" accent="yellow" />
      </div>
      <Toolbar searchPlaceholder="Buscar por descrição, categoria...">
        <select className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold">
          <option>Todos os tipos</option><option>Entradas</option><option>Saídas</option>
        </select>
        <select className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold">
          <option>Últimos 30 dias</option><option>Este mês</option><option>Personalizado</option>
        </select>
      </Toolbar>
      <DataTable
        rows={[] as Array<{ data: string; desc: string; cat: string; tipo: string; valor: string; saldo: string }>}
        empty="Nenhuma movimentação registrada."
        columns={[
          { key: "data", label: "Data" },
          { key: "desc", label: "Descrição" },
          { key: "cat", label: "Categoria", render: (r) => <Badge tone="neutral">{r.cat}</Badge> },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone={r.tipo === "Entrada" ? "green" : "pink"}>{r.tipo}</Badge> },
          { key: "valor", label: "Valor" },
          { key: "saldo", label: "Saldo" },
        ]}
      />
    </div>
  );
}
