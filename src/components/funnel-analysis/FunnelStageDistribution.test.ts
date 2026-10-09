import { describe, expect, it } from "vitest";
import { funnelStageDistributionTotal, funnelStageVisualWidth } from "@/lib/funnelStageDistribution";

const stage = (count: number) => ({
  rd_stage_id: `stage-${count}`,
  name: "Lead Novo",
  order: 1,
  is_won: false,
  is_lost: false,
  count,
  cumulative: count,
  pct: 100,
  avgDaysInStage: 0,
  valueInNegotiation: 0,
});

describe("FunnelStageDistribution", () => {
  it("uses the selected period distribution instead of the historical inventory", () => {
    const historical = { stages: [stage(341)] };
    const selectedPeriod = { stages: [stage(141)] };

    expect(funnelStageDistributionTotal(selectedPeriod)).toBe(141);
    expect(funnelStageDistributionTotal(selectedPeriod)).not.toBe(funnelStageDistributionTotal(historical));
  });

  it("scales visual stages proportionally while keeping small stages visible", () => {
    expect(funnelStageVisualWidth(100, 100)).toBe(100);
    expect(funnelStageVisualWidth(50, 100)).toBe(50);
    expect(funnelStageVisualWidth(1, 100)).toBe(32);
    expect(funnelStageVisualWidth(0, 0)).toBe(32);
  });

  it("does not produce an invalid visual width for zero-count stages", () => {
    const counts = [80, 20, 0];
    const widths = counts.map((count) => funnelStageVisualWidth(count, Math.max(...counts)));

    expect(widths).toEqual([100, 32, 32]);
    expect(widths.every((width) => Number.isFinite(width) && width >= 32 && width <= 100)).toBe(true);
  });

  it("keeps the selected-period total independent from stage display widths", () => {
    const selectedPeriod = { stages: [stage(80), stage(20), stage(0)] };

    expect(funnelStageDistributionTotal(selectedPeriod)).toBe(100);
    expect(funnelStageVisualWidth(80, 80)).toBe(100);
    expect(funnelStageVisualWidth(20, 80)).toBe(32);
  });
});
