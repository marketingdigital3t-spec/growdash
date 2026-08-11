/**
 * Stages in RD are configured by each operation. The common terminal labels
 * "Venda" and "Vendas" must count as won, just like "Venda realizada".
 * Pre-venda is intentionally not a terminal stage.
 */
export function isWonRDStageName(value: string | null | undefined): boolean {
  const name = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();

  if (!name || /\b(pre|pos) venda\b/.test(name)) return false;
  return /^(venda|vendas|sale|sales)$/.test(name)
    || /\b(vendas? realizadas?|vendas? concluidas?|vendas? ganhas?|fechado ganho|ganho|won|cliente)\b/.test(name);
}
