export interface CampaignSpendNoLeads {
  id: string;
  name: string;
  objective: string;
  spend: number;
  leads: number;
}

export interface InsightRow {
  spend: number;
  form_leads: number | null;
  site_leads: number | null;
  conversations: number | null;
  campaign: { id: string; name: string; objective: string | null } | null;
}

/**
 * Identifica campanhas com spend > R$50 nos últimos 30 dias e zero leads
 * (form_leads + site_leads + conversations). Usado pelo card de diagnóstico
 * de campanhas com spend sem leads na página Data Health.
 *
 * Regras:
 * - O legacy insights.leads é intencionalmente excluído; o diagnóstico
 *   deve bater com o contrato de lead do Ads Manager (forms + site + conversations).
 * - Só campanhas com spend acima de R$50 são consideradas.
 * - O resultado é ordenado por spend decrescente.
 */
export function detectCampaignsWithSpendNoLeads(
  rows: InsightRow[],
): CampaignSpendNoLeads[] {
  const byCampaign = new Map<string, CampaignSpendNoLeads>();

  for (const r of rows) {
    const c = r.campaign;
    if (!c) continue;
    const cur = byCampaign.get(c.id) || {
      id: c.id,
      name: c.name,
      objective: c.objective || "—",
      spend: 0,
      leads: 0,
    };
    cur.spend += Number(r.spend || 0);
    cur.leads +=
      Math.max(0, Number(r.form_leads || 0)) +
      Math.max(0, Number(r.site_leads || 0)) +
      Math.max(0, Number(r.conversations || 0));
    byCampaign.set(c.id, cur);
  }

  return Array.from(byCampaign.values())
    .filter((c) => c.spend > 50 && c.leads === 0)
    .sort((a, b) => b.spend - a.spend);
}
