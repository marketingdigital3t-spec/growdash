/**
 * Commercial reference values for open RD opportunities that have no amount
 * yet. They are display-only estimates: a value supplied by RD or manually
 * entered by the seller always takes precedence in getRDDealAmount.
 */
export function accountOpportunityFallback(accountName: string | null | undefined): number | undefined {
  const normalized = (accountName || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!/rannie?l?y/.test(normalized)) return undefined;
  // CA02 must be evaluated first because its name also contains "CA".
  if (/(^|\s)ca0?2(\s|$)/.test(normalized)) return 7_500;
  if (/(^|\s)ca(\s|$)/.test(normalized)) return 5_000;
  return undefined;
}
