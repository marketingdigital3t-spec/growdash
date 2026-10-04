import { describe, expect, it } from "vitest";
import { stagesFromRDDealSnapshot } from "../../supabase/functions/_shared/rdStageSnapshot";

describe("stagesFromRDDealSnapshot", () => {
  it("recovers the real funnel stages from persisted RD deals, preserving order and status", () => {
    const result = stagesFromRDDealSnapshot({ id: "funnel-1", user_id: "owner-1", ad_account_id: null }, [
      { rd_stage_id: "won", rd_stage_name: "Venda Realizada", rd_stage_order: 7, stage_bucket: "client", win: true },
      { rd_stage_id: "lead", rd_stage_name: "Lead Novo", rd_stage_order: 1, stage_bucket: "lead", win: false },
      { rd_stage_id: "lost", rd_stage_name: "Perdido", rd_stage_order: 9, stage_bucket: "lost", win: false },
      { rd_stage_id: "lead", rd_stage_name: "Lead Novo", rd_stage_order: 1, stage_bucket: "lead", win: false },
      { rd_stage_id: null, rd_stage_name: "Sem etapa", rd_stage_order: null, stage_bucket: "lead", win: false },
    ], "2026-10-04T12:00:00.000Z");

    expect(result.map((stage) => [stage.rd_stage_id, stage.name, stage.order])).toEqual([
      ["lead", "Lead Novo", 1],
      ["won", "Venda Realizada", 7],
      ["lost", "Perdido", 9],
    ]);
    expect(result.find((stage) => stage.rd_stage_id === "won")?.is_won).toBe(true);
    expect(result.find((stage) => stage.rd_stage_id === "lost")?.is_lost).toBe(true);
    expect(result.every((stage) => stage.rd_funnel_id === "funnel-1" && stage.user_id === "owner-1")).toBe(true);
  });
});
