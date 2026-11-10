import type { MetricAvailability } from "@/lib/metricAvailability";

export interface FunnelMetricAvailabilityInput {
  /** Meta has a confirmed snapshot for this exact scope. */
  hasMetaSnapshot: boolean;
  /** The Meta request is still in flight. */
  metaLoading: boolean;
  /** Meta has no snapshot for this scope and is not loading it. */
  metaUnavailable: boolean;
  metaReason?: string | null;
  /** The RD period read returned a confirmed snapshot. */
  hasRDSnapshot: boolean;
  rdLoading: boolean;
  rdError: boolean;
  rdReason?: string | null;
  /** An RD reconciliation is running in the background. */
  rdSyncing: boolean;
}

/**
 * Decides how each funnel metric must be presented while a provider refresh
 * is running. A persisted snapshot is always displayable: the refresh must
 * never replace a confirmed number with a spinner, "Indisponível" or a fake
 * zero. Only a scope without any confirmed snapshot may show a pending or
 * unavailable state.
 */
export function buildFunnelMetricAvailability(input: FunnelMetricAvailabilityInput) {
  const metaState = (): MetricAvailability => {
    if (input.hasMetaSnapshot) {
      return input.metaLoading || input.rdSyncing
        ? { state: "stale", reason: "Atualizando em segundo plano; o último snapshot permanece visível." }
        : { state: "fresh" };
    }
    if (input.metaLoading) return { state: "loading" };
    if (input.metaUnavailable) {
      return { state: "unavailable", reason: input.metaReason || "Meta Ads ainda não sincronizou este recorte." };
    }
    return { state: "loading" };
  };

  const rdState = (): MetricAvailability => {
    if (input.hasRDSnapshot) {
      if (input.rdError) {
        return { state: "partial", reason: input.rdReason || "A última leitura do RD falhou; o snapshot anterior permanece visível." };
      }
      return input.rdLoading || input.rdSyncing
        ? { state: "stale", reason: "Atualizando o RD em segundo plano; o último snapshot permanece visível." }
        : { state: "fresh" };
    }
    if (input.rdError) {
      return { state: "unavailable", reason: input.rdReason || "Não foi possível ler as negociações do RD neste recorte." };
    }
    if (input.rdLoading) return { state: "loading" };
    return { state: "loading" };
  };

  return {
    meta: metaState(),
    rd: rdState(),
  };
}

/**
 * The RD stage catalog is an optional enrichment. Persisted deal facts
 * already carry the real stage id, name and order, so the funnel renders
 * without it. The warning is only truthful when no stage could be recovered
 * from either source.
 */
export function hasRenderableFunnelStages(catalogStages: number, recoveredStages: number) {
  return catalogStages > 0 || recoveredStages > 0;
}
