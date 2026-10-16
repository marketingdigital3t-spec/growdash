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

export type CRMStageIdentitySource = {
  sourceId: string;
  funnelId: string | null;
  stageId: string | null;
  name: string | null;
  order: number | null;
  won: boolean;
  lost: boolean;
};

export type CRMStageIdentity = {
  id: string;
  name: string;
  order: number;
  won: boolean;
  lost: boolean;
  funnelId: string | null;
  stageId: string | null;
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

function isWonStageLabel(value: string) {
  return /^(venda|vendas|sale|sales)$/.test(value)
    || /\b(vendid[oa]s?|vendas? realizadas?|vendas? concluidas?|vendas? ganhas?|fechado ganho|ganho|won|cliente)\b/.test(value);
}

function isLostStageLabel(value: string) {
  return /\b(perdid[oa]s?|perda|lost|desqualificad[oa]s?)\b/.test(value);
}

export function normalizedStageName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Historical RD stages remain visible in the canonical CRM history. */
export function isExcludedLegacyRannielyStage(funnelName: string | null | undefined, stageName: string | null | undefined) {
  void funnelName;
  void stageName;
  return false;
}

/**
 * Keeps every RD deal in operational metrics, including historical stages.
 */
export function filterOperationalRDDeals<T extends RDDealStageSource>(deals: T[], funnels: RDFunnelStageSource[]) {
  const funnelNameById = new Map(funnels.map((funnel) => [funnel.id, funnel.name]));
  return deals.filter((deal) => !isExcludedLegacyRannielyStage(
    funnelNameById.get(deal.rd_funnel_id ?? ""),
    deal.rd_stage_name,
  ));
}

/** Kept for API compatibility; no historical RD deal is excluded. */
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

/** Retains all stages returned by RD, including historical stages. */
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
  const key = normalizedStageName(sourceName);

  // RD snapshots can disagree on the technical `is_won` flag while retaining
  // the provider's terminal label. The label is the authoritative fallback:
  // otherwise one stale stage row becomes a second "Venda Realizada" column
  // and its deals stop contributing to the same card/KPI.
  if (source.won || isWonStageLabel(key)) return { id: "won", name: "Vendas ganhas", order: 900, won: true, lost: false };
  if (source.lost || isLostStageLabel(key)) return { id: "lost", name: "Perdidas", order: 950, won: false, lost: true };
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

/**
 * Coalesces duplicate snapshots of a named stage within one RD funnel.
 *
 * RD can recreate a stage and keep the old local snapshot around. The two
 * provider IDs are still mapped back to the same board card, so no deals are
 * dropped while the CRM mirrors RD's single named column.
 */
export function mergeCRMStageSources(
  sources: CRMStageIdentitySource[],
  options: { preserveFunnelBoundaries?: boolean } = {},
) {
  const stages = new Map<string, CRMStageIdentity>();
  const sourceToCanonicalId = new Map<string, string>();
  const idByFunnelAndName = new Map<string, string>();
  const preserveFunnelBoundaries = options.preserveFunnelBoundaries ?? true;

  for (const source of sources) {
    const labelKey = preserveFunnelBoundaries
      ? `${source.funnelId || "unassigned-funnel"}:${normalizedStageName(source.name) || "sem etapa"}`
      : normalizedStageName(source.name) || "sem etapa";
    const id = idByFunnelAndName.get(labelKey) || source.sourceId;
    idByFunnelAndName.set(labelKey, id);
    sourceToCanonicalId.set(source.sourceId, id);
    const current = stages.get(id);
    if (!current) {
      stages.set(id, {
        id,
        name: source.name || "Sem etapa",
        order: source.order ?? 9_999,
        won: source.won,
        lost: source.lost,
        funnelId: source.funnelId,
        stageId: source.stageId,
      });
      continue;
    }
    current.order = Math.min(current.order, source.order ?? 9_999);
    current.won = current.won || source.won;
    current.lost = current.lost || source.lost;
  }

  return {
    stages: Array.from(stages.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")),
    sourceToCanonicalId,
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
