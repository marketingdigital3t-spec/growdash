import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function funnelStageDistributionTotal(a: Pick<FunnelAnalytics, "stages">) {
  return a.stages.reduce((sum, stage) => sum + stage.count, 0);
}

export function funnelStageVisualWidth(index: number, stageCount: number) {
  if (stageCount <= 1) return 100;
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  return Math.round(100 - progress * 56);
}

export function funnelStageVisualColor(index: number, stageCount: number) {
  if (stageCount <= 1) return "hsl(142 71% 45%)";
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  const hue = Math.round(progress * 142);
  return `hsl(${hue} 84% 56%)`;
}
