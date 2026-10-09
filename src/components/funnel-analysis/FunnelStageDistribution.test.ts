import { describe, expect, it } from "vitest";
import { funnelStageDistributionTotal, funnelStageVisualColor, funnelStageVisualWidth } from "@/lib/funnelStageDistribution";

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

  it("creates a descending funnel width from the first to the last stage", () => {
    const widths = [0, 1, 2, 3].map((index) => funnelStageVisualWidth(index, 4));

    expect(widths).toEqual([100, 81, 63, 44]);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });

  it("keeps a single or empty funnel stage valid", () => {
    expect(funnelStageVisualWidth(0, 0)).toBe(100);
    expect(funnelStageVisualWidth(0, 1)).toBe(100);
    expect(funnelStageVisualWidth(8, 3)).toBe(44);
  });

  it("transitions the visual palette from red through yellow to green", () => {
    expect(funnelStageVisualColor(0, 3)).toBe("hsl(0 84% 56%)");
    expect(funnelStageVisualColor(1, 3)).toBe("hsl(71 84% 56%)");
    expect(funnelStageVisualColor(2, 3)).toBe("hsl(142 84% 56%)");
  });

  it("keeps the selected-period total independent from the funnel shape", () => {
    const selectedPeriod = { stages: [stage(80), stage(20), stage(0)] };

    expect(funnelStageDistributionTotal(selectedPeriod)).toBe(100);
    expect(funnelStageVisualWidth(0, selectedPeriod.stages.length)).toBe(100);
    expect(funnelStageVisualWidth(2, selectedPeriod.stages.length)).toBe(44);
  });
});
