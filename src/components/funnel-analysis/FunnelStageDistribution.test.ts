import { describe, expect, it } from "vitest";
import { funnelStageDistributionTotal, funnelStageStageTone, funnelStageTransitionRate } from "@/lib/funnelStageDistribution";

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

  it("calculates the next-stage rate from the current stage", () => {
    expect(funnelStageTransitionRate(10, 4)).toBe(40);
    expect(funnelStageTransitionRate(3, 1)).toBeCloseTo(33.3, 1);
  });

  it("does not invent a conversion rate when the current stage is empty", () => {
    expect(funnelStageTransitionRate(0, 4)).toBeNull();
  });

  it("keeps won and lost stages semantically distinct from neutral stages", () => {
    expect(funnelStageStageTone({ is_won: true, is_lost: false })).toBe("won");
    expect(funnelStageStageTone({ is_won: false, is_lost: true })).toBe("lost");
    expect(funnelStageStageTone({ is_won: false, is_lost: false })).toBe("neutral");
  });

  it("keeps the selected-period total independent from the funnel shape", () => {
    const selectedPeriod = { stages: [stage(80), stage(20), stage(0)] };

    expect(funnelStageDistributionTotal(selectedPeriod)).toBe(100);
    expect(funnelStageTransitionRate(80, 20)).toBe(25);
  });
});
