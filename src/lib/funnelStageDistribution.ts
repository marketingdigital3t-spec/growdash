import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export type FunnelStageTone = "neutral" | "won" | "lost";

export function funnelStageDistributionTotal(a: Pick<FunnelAnalytics, "stages">) {
  return a.stages.reduce((sum, stage) => sum + stage.count, 0);
}

export function funnelStageVisualWidth(index: number, stageCount: number) {
  if (stageCount <= 1) return 100;
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  return Math.round(100 - progress * 72);
}

export function funnelStageVisualColor(index: number, stageCount: number) {
  if (stageCount <= 1) return "hsl(142 71% 45%)";
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  const hue = Math.round(progress * 142);
  return `hsl(${hue} 84% 56%)`;
}

export function funnelStageVisualTextColor(index: number, stageCount: number) {
  void index;
  void stageCount;
  return "hsl(0 0% 100%)";
}

export function funnelStageTransitionRate(currentCount: number, nextCount: number) {
  if (currentCount <= 0) return null;
  return (nextCount / currentCount) * 100;
}

export function funnelStageStageTone(stage: Pick<FunnelAnalytics["stages"][number], "is_won" | "is_lost">): FunnelStageTone {
  if (stage.is_won) return "won";
  if (stage.is_lost) return "lost";
  return "neutral";
}
