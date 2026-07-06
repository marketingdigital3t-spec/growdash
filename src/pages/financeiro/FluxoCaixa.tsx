import { PageHeader, StatCard } from "@/components/page-primitives";
import { Card } from "@/components/list-primitives";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

const meses = [
  { m: "Jan", e: 68, s: 42 }, { m: "Fev", e: 72, s: 48 }, { m: "Mar", e: 78, s: 51 },
  { m: "Abr", e: 84, s: 55 }, { m: "Mai", e: 91, s: 58 }, { m: "Jun", e: 96, s: 62 }, { m: "Jul", e: 84, s: 47 },
];
const max = Math.max(...meses.flatMap((m) => [m.e, m.s]));

export default function FluxoCaixa() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Financeiro", "Fluxo de caixa"]}
        title="Fluxo de caixa"
        subtitle="Visão consolidada de entradas e saídas."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Entradas do mês" value="R$ 84.320" hint="+12% vs. mês anterior" accent="green" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Saídas do mês" value="R$ 47.180" hint="+4% vs. mês anterior" accent="pink" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Saldo" value="R$ 37.140" hint="Meta: R$ 40.000" accent="primary" icon={<Wallet className="h-4 w-4" />} />
      </div>

      <Card title="Últimos 7 meses" subtitle="Entradas (rosa) e saídas (cinza) em R$ mil">
        <div className="flex h-64 items-end gap-4">
          {meses.map((m) => (
            <div key={m.m} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end gap-1">
                <div className="flex-1 rounded-t-lg bg-primary" style={{ height: `${(m.e / max) * 100}%` }} />
                <div className="flex-1 rounded-t-lg bg-muted-foreground/40" style={{ height: `${(m.s / max) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-muted-foreground">{m.m}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
