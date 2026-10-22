import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export type FunnelStageTone = "neutral" | "won" | "lost";

export function funnelStageDistributionTotal(a: Pick<FunnelAnalytics, "stages">) {
  return a.stages.reduce((sum, stage) => sum + stage.count, 0);
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
