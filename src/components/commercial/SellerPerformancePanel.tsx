import { Target, Ticket, TrendingUp, Trophy, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { computeSellerGoal, deriveSellerTarget, type SellerGoalInput } from "@/lib/commercialSellerGoal";
import { cn } from "@/lib/utils";

interface Props {
  sellers: SellerGoalInput[];
  /** Receita total da conta, usada para derivar a fatia de meta de cada vendedor. */
  accountTotalRevenue: number;
  /** Meta de receita da conta, quando existe. */
  accountTarget?: number | null;
  className?: string;
}

const fmtBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtInt = (value: number) => value.toLocaleString("pt-BR");

/**
 * Painel de performance por vendedor: a primeira coisa que a pagina comercial
 * mostra. Cada linha responde as quatro perguntas do operador:
 * quantas vendas fez, qual a meta, quanto falta em percentual e quantas
 * vendas ainda faltam - ultimo numero calculado pelo ticket medio real.
 */
export function SellerPerformancePanel({ sellers, accountTotalRevenue, accountTarget, className = "" }: Props) {
  const linhas = sellers
    .map((seller) => {
      const target = seller.target ?? deriveSellerTarget(seller.revenue, accountTotalRevenue, accountTarget);
      return computeSellerGoal({ ...seller, target });
    })
    .sort((a, b) => (b.goalPercentage ?? -1) - (a.goalPercentage ?? -1) || b.revenue - a.revenue);

  if (!linhas.length) {
    return (
      <Card className={cn("gd-panel border-border/60 bg-card/70", className)}>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Nenhuma venda atribuída a vendedores neste recorte.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("gd-panel overflow-hidden border-border/60 bg-card/70 backdrop-blur", className)}>
      <CardContent className="space-y-3 p-5">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-black">Performance por vendedor</h2>
              <p className="text-[11px] text-muted-foreground">
                Vendas, meta e quantas vendas ainda faltam no período selecionado.
              </p>
            </div>
          </div>
          {accountTarget && accountTarget > 0 && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              Meta da conta: {fmtBRL(accountTarget)}
            </span>
          )}
        </header>

        <div className="grid gap-2">
          {linhas.map((linha) => {
            const percentual = linha.goalPercentage;
            const semMeta = linha.target === null;
            const batida = percentual !== null && percentual >= 100;
            const corBarra = semMeta
              ? "bg-muted-foreground/40"
              : batida
                ? "bg-emerald-500"
                : percentual !== null && percentual >= 60
                  ? "bg-amber-500"
                  : "bg-rose-500";
            const largura = percentual === null ? 0 : Math.min(100, Math.max(2, percentual));

            return (
              <article
                key={linha.seller}
                className="rounded-xl border border-border/60 bg-muted/25 p-3 transition hover:border-primary/35"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <b className="truncate text-sm font-bold text-foreground">{linha.seller}</b>
                  <span className="flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                    <Trophy className="h-3.5 w-3.5 text-primary" />
                    {fmtInt(linha.salesCount)} {linha.salesCount === 1 ? "venda" : "vendas"}
                  </span>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <span
                    className={cn("block h-full rounded-full transition-all", corBarra)}
                    style={{ width: `${largura}%` }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {percentual === null
                      ? "Sem meta cadastrada"
                      : `${percentual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da meta`}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <Ticket className="h-3.5 w-3.5" />
                    Ticket {linha.averageTicket === null ? "—" : fmtBRL(linha.averageTicket)}
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {linha.salesToGoal === null
                      ? semMeta
                        ? "Meta não definida"
                        : "Sem base para estimar"
                      : linha.salesToGoal === 0
                        ? "Meta batida"
                        : `Faltam ${fmtInt(linha.salesToGoal)} venda${linha.salesToGoal === 1 ? "" : "s"}`}
                  </span>

                  <span className="ml-auto tabular-nums">
                    {fmtBRL(linha.revenue)}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
