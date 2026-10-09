import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function funnelStageDistributionTotal(a: Pick<FunnelAnalytics, "stages">) {
  return a.stages.reduce((sum, stage) => sum + stage.count, 0);
}

export function funnelStageVisualWidth(count: number, maxCount: number) {
  if (maxCount <= 0 || count <= 0) return 32;
  return Math.max(32, Math.min(100, (count / maxCount) * 100));
}
