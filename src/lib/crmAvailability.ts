import type { MetricAvailability } from "./metricAvailability";

export interface CrmMetricAvailabilityInput {
  loading: boolean;
  failed: boolean;
  hasSnapshot: boolean;
  hasRows: boolean;
  reason?: string | null;
  noSnapshotReason?: string;
}

/**
 * Derives the display state from the RD deals query itself. Funnel metadata or
 * cached timestamps are not sufficient evidence for a CRM metric snapshot.
 */
export function buildCrmMetricAvailability({ loading, failed, hasSnapshot, hasRows, reason }: CrmMetricAvailabilityInput): MetricAvailability {
  if (loading) {
    return hasSnapshot
      ? { state: "stale", reason: "Atualizando o escopo selecionado; o último snapshot permanece visível." }
      : { state: "loading" };
  }
  if (failed) {
    return hasSnapshot
      ? { state: "partial", reason: reason || "Uma fonte falhou; o último snapshot permanece visível." }
      : { state: "unavailable", reason: reason || "Não foi possível confirmar os dados do RD Station." };
  }
  if (hasSnapshot) return hasRows ? { state: "fresh" } : { state: "empty_confirmed" };
  return { state: "unavailable", reason: noSnapshotReason || "Aguardando a primeira sincronização confirmada do RD Station." };
}

export function crmBoardSummaryLabel(state: MetricAvailability["state"], boardCount: number) {
  if (state === "loading") return "Carregando negociações…";
  if (state === "unavailable") return "Negociações indisponíveis";
  return `${new Intl.NumberFormat("pt-BR").format(boardCount)} negociação(ões) no quadro`;
}
