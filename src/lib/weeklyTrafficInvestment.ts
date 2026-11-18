/**
 * Investimento em trafego por semana: quanto foi investido, quanto era a
 * meta, quanto da meta foi alcancado e quanto foi colocado na conta.
 *
 * O operador precisa de tres leituras no mesmo lugar:
 * - Investido: gasto real da semana (com o imposto Meta de 12,15% a parte).
 * - Meta: quanto era para investir naquela semana.
 * - Colocado: quanto entrou na conta (aporte) naquela semana.
 *
 * Colocado e investido sao numeros diferentes: o primeiro e dinheiro que
 * entrou na conta, o segundo e dinheiro que a Meta gastou. A diferenca e o
 * saldo que sobrou ou o que ainda esta para ser investido.
 */

export interface WeeklyInvestmentRow {
  /** Semana no formato "dd/MM". */
  label: string;
  /** Gasto real da semana, ja com o imposto quando pedido. */
  invested: number;
  /** Gasto real da semana sem o imposto da Meta. */
  investedRaw: number;
  /** Meta de investimento da semana, quando existe. */
  target: number | null;
  /** Percentual da meta alcancado. `null` sem meta. */
  goalPercentage: number | null;
  /** Diferenca entre o investido e a meta (positivo = acima). */
  difference: number | null;
  /** Aportes confirmados na semana. */
  deposited: number;
  /** Aportes pendentes na semana. */
  depositedPending: number;
  /** Saldo da conta ao fim da semana (colocado - investido). */
  balance: number;
}

export interface WeeklyInvestmentInput {
  label: string;
  invested: number;
  investedRaw: number;
  deposited: number;
  depositedPending: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Monta as linhas semanais ja com meta, percentual e saldo.
 *
 * A meta semanal vem de `weeklyTarget` quando existe (meta do período
 * dividida pelas semanas do recorte). Sem meta, a linha continua mostrando
 * o que foi investido e colocado — a meta e o percentual ficam `null`, e
 * nunca zero, que seria lido como "meta batida".
 */
export function buildWeeklyInvestment(
  rows: WeeklyInvestmentInput[],
  weeklyTarget: number | null | undefined,
): WeeklyInvestmentRow[] {
  const meta = isFiniteNumber(weeklyTarget) && weeklyTarget > 0 ? weeklyTarget : null;

  return rows.map((row) => {
    const invested = isFiniteNumber(row.invested) ? row.invested : 0;
    const investedRaw = isFiniteNumber(row.investedRaw) ? row.investedRaw : 0;
    const deposited = isFiniteNumber(row.deposited) ? row.deposited : 0;
    const depositedPending = isFiniteNumber(row.depositedPending) ? row.depositedPending : 0;

    const goalPercentage = meta !== null && meta > 0 ? (invested / meta) * 100 : null;
    const difference = meta !== null ? invested - meta : null;

    return {
      label: row.label,
      invested,
      investedRaw,
      target: meta,
      goalPercentage,
      difference,
      deposited,
      depositedPending,
      balance: deposited - invested,
    };
  });
}

/**
 * Divide a meta do periodo pelas semanas do recorte.
 *
 * `weeks` e o numero de semanas realmente cobertas pelos dados. Sem meta ou
 * sem semanas, o resultado e `null` e a interface mostra "sem meta".
 */
export function deriveWeeklyTarget(
  periodTarget: number | null | undefined,
  weeks: number,
): number | null {
  if (!isFiniteNumber(periodTarget) || periodTarget <= 0) return null;
  if (!isFiniteNumber(weeks) || weeks <= 0) return null;
  return periodTarget / weeks;
}
