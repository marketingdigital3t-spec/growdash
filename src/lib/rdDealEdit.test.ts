import { describe, expect, it } from "vitest";
import { buildRDDealUpdate, serializeRDDealUpdate, statusFromRDDeal, type DealEditSnapshot } from "./rdDealEdit";

const snapshot: DealEditSnapshot = {
  name: "Lead aberto",
  amount: "0",
  status: "open",
  hold: false,
  rating: "1",
  predictionDate: "",
  lostNote: "",
};

describe("rdDealEdit", () => {
  it("recognizes an RD open deal even when the provider flag is false", () => {
    expect(statusFromRDDeal({ win: false, stage_bucket: "opportunity" })).toBe("open");
    expect(statusFromRDDeal({ win: false, stage_bucket: "lost" })).toBe("lost");
  });

  it("does not send win=false when only the name changes", () => {
    expect(buildRDDealUpdate(snapshot, { ...snapshot, name: "Lead renomeado" })).toEqual({ name: "Lead renomeado" });
  });

  it("requires an explicit loss selection to send win=false", () => {
    const update = buildRDDealUpdate(snapshot, { ...snapshot, status: "lost", lostNote: "Sem retorno" });
    expect(update).toEqual({
      deal_lost_note: "Sem retorno",
      win: false,
      confirm_loss: true,
    });
    expect(serializeRDDealUpdate(update)).toEqual({
      fields: { deal_lost_note: "Sem retorno", win: false },
      confirm_loss: true,
    });
  });

  it("serializes the invested amount as the RD deal amount", () => {
    const update = buildRDDealUpdate(snapshot, { ...snapshot, amount: "12.500,00" });
    expect(update).toEqual({ amount: 12500 });
    expect(serializeRDDealUpdate(update)).toEqual({ fields: { amount: 12500 }, confirm_loss: false });
  });
});
