import { ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Toolbar, DataTable, Button, Badge } from "@/components/list-primitives";

const rows = [
  { data: "05/07/2026", desc: "Venda — Ana B. Souza (Pacote laser)", cat: "Vendas", tipo: "Entrada", valor: "+ R$ 3.500,00", saldo: "R$ 41.240,00" },
  { data: "04/07/2026", desc: "Salário — Enf. Carla", cat: "Folha", tipo: "Saída", valor: "- R$ 4.500,00", saldo: "R$ 37.740,00" },
  { data: "04/07/2026", desc: "Venda — Camila Oliveira", cat: "Vendas", tipo: "Entrada", valor: "+ R$ 350,00", saldo: "R$ 42.240,00" },
  { data: "03/07/2026", desc: "Insumos Beauty Supply", cat: "Insumos", tipo: "Saída", valor: "- R$ 2.340,00", saldo: "R$ 41.890,00" },
  { data: "02/07/2026", desc: "Venda — Juliana Ramos (1/3)", cat: "Vendas", tipo: "Entrada", valor: "+ R$ 400,00", saldo: "R$ 44.230,00" },
  { data: "02/07/2026", desc: "Energia elétrica", cat: "Utilidades", tipo: "Saída", valor: "- R$ 780,00", saldo: "R$ 43.830,00" },
];

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
        <StatCard label="Saldo atual" value="R$ 41.240,00" accent="primary" />
        <StatCard label="Entradas mês" value="R$ 84.320,00" hint="42 lançamentos" accent="green" icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard label="Saídas mês" value="R$ 47.180,00" hint="28 lançamentos" accent="pink" icon={<ArrowDownRight className="h-4 w-4" />} />
        <StatCard label="Resultado mês" value="R$ 37.140,00" hint="+18% vs. mês anterior" accent="yellow" />
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
        rows={rows}
        columns={[
          { key: "data", label: "Data" },
          { key: "desc", label: "Descrição" },
          { key: "cat", label: "Categoria", render: (r) => <Badge tone="neutral">{r.cat}</Badge> },
          { key: "tipo", label: "Tipo", render: (r) => <Badge tone={r.tipo === "Entrada" ? "green" : "pink"}>{r.tipo}</Badge> },
          { key: "valor", label: "Valor", render: (r) => <span className={r.tipo === "Entrada" ? "text-[hsl(145_60%_35%)]" : "text-[hsl(340_85%_55%)]"}>{r.valor}</span> },
          { key: "saldo", label: "Saldo" },
        ]}
      />
    </div>
  );
}
