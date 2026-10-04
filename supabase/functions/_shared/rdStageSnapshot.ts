export type RDDealStageSnapshot = {
  rd_stage_id: string | null;
  rd_stage_name: string | null;
  rd_stage_order: number | null;
  stage_bucket: string | null;
  win: boolean | null;
};

export function stagesFromRDDealSnapshot(
  funnel: { id: string; user_id: string; ad_account_id: string | null },
  deals: RDDealStageSnapshot[],
  updatedAt = new Date().toISOString(),
) {
  const unique = new Map<string, {
    rd_funnel_id: string;
    ad_account_id: string | null;
    user_id: string;
    rd_stage_id: string;
    name: string;
    nickname: null;
    order: number;
    is_won: boolean;
    is_lost: boolean;
    updated_at: string;
  }>();

  for (const deal of deals) {
    const id = String(deal.rd_stage_id || "").trim();
    const name = String(deal.rd_stage_name || "").trim();
    if (!id || !name || unique.has(id)) continue;
    const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const won = Boolean(deal.win) || deal.stage_bucket === "client"
      || /\b(venda|vendas|venda real|venda concluida|venda ganha|ganho|won|cliente)\b/.test(normalized);
    const lost = deal.stage_bucket === "lost" || deal.stage_bucket === "disqualified"
      || /\b(perdido|perdida|perda|lost)\b/.test(normalized);
    unique.set(id, {
      rd_funnel_id: funnel.id,
      ad_account_id: funnel.ad_account_id,
      user_id: funnel.user_id,
      rd_stage_id: id,
      name,
      nickname: null,
      order: Number.isFinite(Number(deal.rd_stage_order)) ? Number(deal.rd_stage_order) : 9_999,
      is_won: won,
      is_lost: lost,
      updated_at: updatedAt,
    });
  }
  return Array.from(unique.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
}
