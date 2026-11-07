import { Award, Crown, Medal, TrendingUp } from "lucide-react";
import { formatCurrency, formatInteger, formatPercent } from "@/lib/format/formatPtBr";

export interface CrewRankingEntry {
  id: string;
  rank: number;
  name: string;
  role: string;
  avatarUrl?: string;
  salesCount: number;
  totalRevenue: number;
  individualGoal: number;
}

interface CrewRankingProps {
  members: CrewRankingEntry[];
  teamGoal?: number;
  className?: string;
}

/**
 * Ranking da Tripulacao (seção 9.8 — aba Comercial).
 *
 * Posicao, avatar, vendas, faturamento, barra de progresso da meta individual
 * e medalha para o top 3. A cor da fase colore a barra de meta.
 */
export function CrewRanking({ members, teamGoal = 0, className = "" }: CrewRankingProps) {
  const teamRevenue = members.reduce((sum, member) => sum + member.totalRevenue, 0);
  const teamProgress = teamGoal > 0 ? Math.min(100, (teamRevenue / teamGoal) * 100) : 0;

  return (
    <section
      aria-labelledby="crew-ranking-title"
      className={`rounded-2xl border border-card-border bg-card-bg/85 p-5 shadow-glow-sm backdrop-blur-xl sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-card-border-active bg-primary/10 text-primary-neon shadow-glow-sm">
            <Award className="h-4 w-4" />
          </span>
          <h2 id="crew-ranking-title" className="text-xs font-bold uppercase tracking-[0.14em] text-text-primary sm:text-sm">
            Ranking da Tripulação
          </h2>
        </div>

        {/* Meta do time */}
        {teamGoal > 0 && (
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Meta do Time
            </span>
            <b className="font-display block text-sm font-bold text-text-primary tabular-nums">
              {formatCurrency(teamRevenue)}{" "}
              <span className="text-text-muted">
                / {formatCurrency(teamGoal)} ({formatPercent(teamProgress, 0)})
              </span>
            </b>
          </div>
        )}
      </div>

      {/* Barra de progresso coletiva */}
      {teamGoal > 0 && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-card-border bg-bg-elevated">
          <div
            className="gd-fuel-fill h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${teamProgress}%` }}
          />
        </div>
      )}

      {/* Lista ordenada da tripulacao */}
      <ol className="mt-5 space-y-2.5">
        {members.map((member) => {
          const progress =
            member.individualGoal > 0
              ? Math.min(100, (member.totalRevenue / member.individualGoal) * 100)
              : 0;
          const isPodium = member.rank <= 3;

          return (
            <li
              key={member.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition hover:border-card-border-active ${
                isPodium ? "border-card-border-active bg-primary/[.06]" : "border-card-border/60 bg-bg-elevated/40"
              }`}
            >
              {/* Posicao com medalha no top 3 */}
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-xs font-black tabular-nums ${
                  member.rank === 1
                    ? "border-warning/40 bg-warning/15 text-warning shadow-glow-sm"
                    : member.rank === 2
                    ? "border-card-border-active bg-primary/10 text-primary-neon"
                    : member.rank === 3
                    ? "border-primary/30 bg-primary/10 text-primary-soft"
                    : "border-card-border bg-bg-elevated text-text-muted"
                }`}
              >
                {member.rank === 1 ? (
                  <Crown className="h-4 w-4" />
                ) : member.rank === 2 || member.rank === 3 ? (
                  <Medal className="h-4 w-4" />
                ) : (
                  member.rank
                )}
              </span>

              {/* Avatar com moldura neon */}
              <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-card-border-active bg-primary/10 text-xs font-extrabold text-primary-neon">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  member.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()
                )}
                {isPodium && (
                  <span className="absolute inset-0 rounded-full border border-primary-neon/40 shadow-glow-sm" />
                )}
              </span>

              {/* Nome, cargo e metricas */}
              <div className="min-w-0 grow">
                <b className="block truncate text-sm font-bold text-text-primary">{member.name}</b>
                <span className="block truncate text-[11px] text-text-muted">{member.role}</span>

                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 min-w-0 grow overflow-hidden rounded-full border border-card-border bg-bg-elevated">
                    <div
                      className="gd-fuel-fill h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-primary-neon tabular-nums">
                    {formatPercent(progress, 0)}
                  </span>
                </div>
              </div>

              {/* Vendas e faturamento */}
              <div className="shrink-0 text-right">
                <b className="font-display block text-sm font-bold text-text-primary tabular-nums">
                  {formatCurrency(member.totalRevenue)}
                </b>
                <span className="flex items-center justify-end gap-1 text-[10px] text-text-muted tabular-nums">
                  <TrendingUp className="h-3 w-3 text-success" />
                  {formatInteger(member.salesCount)} vendas
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
