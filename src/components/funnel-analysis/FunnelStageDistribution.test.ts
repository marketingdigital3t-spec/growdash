import { describe, expect, it } from "vitest";
import { funnelStageDistributionTotal } from "@/lib/funnelStageDistribution";

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
});
