export interface RDDealAmountSource {
  amount_total: number | null | undefined;
  amount_total_effective?: number | null | undefined;
}

/** Valor que deve ser exibido e agregado pela Growdash.
 * `amount_total` é mantido como valor original recebido do RD; a coluna
 * efetiva pode conter uma regra de preço auditável aplicada no banco. */
export function getRDDealAmount(deal: RDDealAmountSource): number {
  const effective = Number(deal.amount_total_effective);
  if (Number.isFinite(effective) && effective > 0) return effective;
  const original = Number(deal.amount_total);
  return Number.isFinite(original) && original > 0 ? original : 0;
}
