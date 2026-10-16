import type { FunnelAnalytics } from "@/hooks/useRDDeals";

export function funnelStageDistributionTotal(a: Pick<FunnelAnalytics, "stages">) {
  return a.stages.reduce((sum, stage) => sum + stage.count, 0);
}

export function funnelStageVisualWidth(index: number, stageCount: number) {
  if (stageCount <= 1) return 100;
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  // Use a stronger taper so a long CRM pipeline still reads as a funnel.
  return Math.round(100 - progress * 72);
}

export function funnelStageVisualColor(index: number, stageCount: number) {
  if (stageCount <= 1) return "hsl(142 71% 45%)";
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  const hue = Math.round(progress * 142);
  return `hsl(${hue} 84% 56%)`;
}

/**
 * The middle and lower funnel stages move through yellow/lime tones. Dark
 * text keeps those bright surfaces readable while the red/orange entrance
 * stages retain white text for contrast.
 */
export function funnelStageVisualTextColor(index: number, stageCount: number) {
  if (stageCount <= 1) return "hsl(0 0% 100%)";
  const progress = Math.max(0, Math.min(1, index / (stageCount - 1)));
  return progress >= 0.34 ? "hsl(222 47% 11%)" : "hsl(0 0% 100%)";
}
