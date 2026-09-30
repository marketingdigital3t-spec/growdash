export type OperationSaleLike = { seller_name?: string | null; gross_amount_cents?: number | null; cash_received_cents?: number | null };

export function fixedParticipantRows<T>(rows: T[], size = 10) {
  return Array.from({ length: size }, (_, index) => rows[index] ?? null);
}

export function rankExpertSales(rows: OperationSaleLike[], goals: Record<string, number> = {}) {
  const grouped = new Map<string, { sales: number; grossRevenue: number; cashReceived: number }>();
  rows.forEach((row) => {
    const name = row.seller_name?.trim() || "Sem responsável";
    const current = grouped.get(name) || { sales: 0, grossRevenue: 0, cashReceived: 0 };
    current.sales += 1;
    current.grossRevenue += Number(row.gross_amount_cents || 0);
    current.cashReceived += Number(row.cash_received_cents || 0);
    grouped.set(name, current);
  });
  return Array.from(grouped.entries()).map(([name, values]) => {
    const goal = Number(goals[name.toLocaleLowerCase()] || 0);
    return { name, ...values, goal, progress: goal ? Math.min(values.grossRevenue / goal, 1) * 100 : 0, ticket: values.sales ? values.grossRevenue / values.sales : 0, collectionRate: values.grossRevenue ? values.cashReceived / values.grossRevenue * 100 : 0 };
  }).sort((a, b) => b.grossRevenue - a.grossRevenue);
}
