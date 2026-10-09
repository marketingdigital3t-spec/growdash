import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function funnelStageDistributionTotal(a: Pick<FunnelAnalytics, "stages">) {
  return a.stages.reduce((sum, stage) => sum + stage.count, 0);
}
