import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { PageHeader, StatCard } from "@/components/page-primitives";
import { Card } from "@/components/list-primitives";

export default function FluxoCaixa() {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul"];
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Fluxo de caixa"]}
        title="Fluxo de caixa"
        subtitle="Visão consolidada de entradas e saídas."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Entradas do mês" value="R$ 0,00" accent="green" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Saídas do mês" value="R$ 0,00" accent="pink" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Saldo" value="R$ 0,00" accent="primary" icon={<Wallet className="h-4 w-4" />} />
      </div>
      <Card title="Últimos 7 meses" subtitle="Sem movimentações registradas.">
        <div className="flex h-64 items-end gap-4">
          {meses.map((m) => (
            <div key={m} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end gap-1">
                <div className="flex-1 rounded-t-lg bg-muted/60" style={{ height: "2%" }} />
                <div className="flex-1 rounded-t-lg bg-muted/40" style={{ height: "2%" }} />
              </div>
              <span className="text-xs font-bold text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
