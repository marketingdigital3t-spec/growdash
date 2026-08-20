export interface RDDealAmountSource {
  amount_total: number | null | undefined;
  amount_total_effective?: number | null | undefined;
}

/** Valor que deve ser exibido e agregado pela Growdash.
 * `amount_total` é mantido como valor original recebido do RD; a coluna
 * efetiva pode conter uma regra de preço auditável aplicada no banco.
 *
 * `productPrice` is a display-only fallback for an open deal whose RD record
 * has no amount. It never overwrites the source record or turns into revenue
 * until the negotiation is actually won and the canonical sales sync runs.
 */
export function getRDDealAmount(deal: RDDealAmountSource, productPrice?: number | null): number {
  const effective = Number(deal.amount_total_effective);
  if (Number.isFinite(effective) && effective > 0) return effective;
  const original = Number(deal.amount_total);
  if (Number.isFinite(original) && original > 0) return original;
  const fallback = Number(productPrice);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
}
