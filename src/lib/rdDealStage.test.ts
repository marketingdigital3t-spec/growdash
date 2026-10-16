import { describe, expect, it } from "vitest";
import { rdDealStageId, rdDealStageName } from "../../supabase/functions/_shared/rdDealStage";

describe("RD deal stage extraction", () => {
  it("supports the provider aliases used by list and detail payloads", () => {
    expect(rdDealStageId({ deal_stage: { id: "nested-id" } })).toBe("nested-id");
    expect(rdDealStageId({ deal_stage_id: 123 })).toBe("123");
    expect(rdDealStageId({ stage_id: "stage-id" })).toBe("stage-id");
    expect(rdDealStageId({ stage: { id: "legacy-id" } })).toBe("legacy-id");
    expect(rdDealStageName({ deal_stage_name: "Venda Realizada" })).toBe("Venda Realizada");
    expect(rdDealStageName({ stage_name: "Oportunidade" })).toBe("Oportunidade");
    expect(rdDealStageName({ stage: { name: "Lead Novo" } })).toBe("Lead Novo");
  });

  it("returns null when the payload has no stage", () => {
    expect(rdDealStageId({})).toBeNull();
    expect(rdDealStageName({})).toBeNull();
  });

  it("allows a repeated deal to be deduplicated only for the same stage", () => {
    const seen = new Map<string, string | null>();
    const first = { id: "deal-1", deal_stage: { id: "stage-a" } };
    const same = { id: "deal-1", deal_stage_id: "stage-a" };
    const moved = { id: "deal-1", stage_id: "stage-b" };

    seen.set(first.id, rdDealStageId(first));
    expect(seen.get(same.id) === rdDealStageId(same)).toBe(true);
    expect(seen.get(moved.id) === rdDealStageId(moved)).toBe(false);
  });
});
