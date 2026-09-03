export type CRMStageSource = {
  id?: string | null;
  name?: string | null;
  order?: number | null;
  won?: boolean;
  lost?: boolean;
};

export type CRMConsolidatedStage = {
  id: string;
  name: string;
  order: number;
  won: boolean;
  lost: boolean;
};

export type RDDealStageSource = {
  rd_funnel_id: string | null;
  rd_stage_name: string | null;
  rd_deal_id?: string | null;
};

export type RDFunnelStageSource = {
  id: string;
  name: string | null;
};

function normalized(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * This imported legacy list belongs to a previous operation and must not be
 * presented as a live stage of Dra. Ranniely's Aluna pipeline. It is hidden in
 * Growdash only; the RD record remains intact for audit and recovery.
 */
export function isExcludedLegacyRannielyStage(funnelName: string | null | undefined, stageName: string | null | undefined) {
  const funnel = normalized(funnelName);
  const stage = normalized(stageName);
  return funnel.includes("ranniely")
    && funnel.includes("aluna")
    && stage.includes("leads antigos")
    // RD names the legacy stage "Leads Antigos do Junior" (without "Dr").
    // Match the stable identifier, not the honorific, so all 82 imported
    // records stay outside Growdash operational totals.
    && stage.includes("junior");
}

/**
 * Applies the operational funnel policy consistently outside the CRM board.
 * The RD record itself is retained; only the imported legacy stage is omitted
 * from business metrics, dashboards and reports.
 */
export function filterOperationalRDDeals<T extends RDDealStageSource>(deals: T[], funnels: RDFunnelStageSource[]) {
  const funnelNameById = new Map(funnels.map((funnel) => [funnel.id, funnel.name]));
  return deals.filter((deal) => !isExcludedLegacyRannielyStage(
    funnelNameById.get(deal.rd_funnel_id ?? ""),
    deal.rd_stage_name,
  ));
}

/**
 * Revenue is persisted separately from the RD pipeline. Keep the corresponding
 * sale rows out of KPIs when their current deal belongs to an excluded stage.
 */
export function excludedOperationalRDDealIds(deals: RDDealStageSource[], funnels: RDFunnelStageSource[]) {
  const funnelNameById = new Map(funnels.map((funnel) => [funnel.id, funnel.name]));
  return new Set(deals.flatMap((deal) => {
    const isExcluded = isExcludedLegacyRannielyStage(
      funnelNameById.get(deal.rd_funnel_id ?? ""),
      deal.rd_stage_name,
    );
    return isExcluded && deal.rd_deal_id ? [deal.rd_deal_id] : [];
  }));
}

type RDFunnelStageRecord = { rd_funnel_id: string | null; name: string | null };

/** The excluded legacy stage must not remain as an empty pipeline column. */
export function filterOperationalRDFunnelStages<T extends RDFunnelStageRecord>(stages: T[], funnels: RDFunnelStageSource[]) {
  const funnelNameById = new Map(funnels.map((funnel) => [funnel.id, funnel.name]));
  return stages.filter((stage) => !isExcludedLegacyRannielyStage(
    funnelNameById.get(stage.rd_funnel_id ?? ""),
    stage.name,
  ));
}

/**
 * Maps equivalent stage labels from independent RD funnels to one operational
 * board column. Exact RD stage IDs remain available when a single account is
 * selected; this normalization is only for the consolidated CRM view.
 */
export function consolidatedCRMStage(source: CRMStageSource): CRMConsolidatedStage {
  const sourceName = source.name?.trim() || "Sem etapa";
  const key = normalized(sourceName);

  if (source.won) return { id: "won", name: "Vendas ganhas", order: 900, won: true, lost: false };
  if (source.lost) return { id: "lost", name: "Perdidas", order: 950, won: false, lost: true };
  if (/\b(lead|novo\w*|nova\w*)\b/.test(key)) return { id: "new-leads", name: "Novos leads", order: 10, won: false, lost: false };
  // Pipelines independentes normalmente escrevem a mesma etapa como SDR,
  // pré-venda, oportunidade ou oportunidades. Na visão "Todas as contas"
  // elas precisam ocupar uma única coluna operacional, não repetir o funil.
  if (/\b(sdr|pre venda|prevenda)\b/.test(key)) return { id: "sdr", name: "SDR", order: 18, won: false, lost: false };
  if (/qualif|triagem/.test(key)) return { id: "qualification", name: "Qualificação", order: 20, won: false, lost: false };
  if (/oportun/.test(key)) return { id: "opportunity", name: "Oportunidades", order: 45, won: false, lost: false };
  if (/nao atendeu|no show/.test(key)) return { id: "unanswered", name: "Não atendidos", order: 28, won: false, lost: false };
  if (/contato|atendiment|conversa/.test(key)) return { id: "contact", name: "Em atendimento", order: 30, won: false, lost: false };
  if (/agend/.test(key)) return { id: "schedule", name: "Agendamento", order: 40, won: false, lost: false };
  if (/propost|orcamento/.test(key)) return { id: "proposal", name: "Proposta", order: 50, won: false, lost: false };
  if (/negoci/.test(key)) return { id: "negotiation", name: "Negociação", order: 60, won: false, lost: false };
  if (/follow|retorno/.test(key)) return { id: "follow-up", name: "Follow-up", order: 70, won: false, lost: false };
  if (/pagamento|checkout/.test(key)) return { id: "payment", name: "Pagamento", order: 80, won: false, lost: false };

  return {
    id: `stage:${key || "unassigned"}`,
    name: sourceName,
    order: source.order ?? 500,
    won: false,
    lost: false,
  };
}

/** Deduplicates stage columns while retaining the earliest meaningful order. */
export function consolidateCRMPipeline(sources: CRMStageSource[]) {
  const stages = new Map<string, CRMConsolidatedStage>();
  for (const source of sources) {
    const next = consolidatedCRMStage(source);
    const current = stages.get(next.id);
    if (!current || next.order < current.order) stages.set(next.id, next);
  }
  return Array.from(stages.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
}
