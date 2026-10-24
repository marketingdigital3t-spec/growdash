import type { MetricAvailability } from "./metricAvailability";

export function crmBoardSummaryLabel(state: MetricAvailability["state"], boardCount: number) {
  if (state === "loading") return "Carregando negociações…";
  if (state === "unavailable") return "Negociações indisponíveis";
  return `${new Intl.NumberFormat("pt-BR").format(boardCount)} negociação(ões) no quadro`;
}
