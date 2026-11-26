import { describe, expect, it } from "vitest";
import { buildTrackingDraft, mergeManualTracking, normalizeTrackingDraft, type TrackingAutoSource } from "./leadTracking";

describe("lead tracking manual override contract", () => {
  it("starts from the automatic attribution and lets a manual value take precedence", () => {
    const automatic: TrackingAutoSource = {
      source: "meta",
      campaign: "Campanha automática",
      adset: "Conjunto automático",
      creative: "Criativo automático",
      form: "Formulário automático",
      platform: "instagram",
      placement: "feed",
      isOrganic: false,
    };

    expect(buildTrackingDraft(automatic, { campaign: "Campanha manual" })).toEqual({
      ...automatic,
      campaign: "Campanha manual",
    });
  });

  it("normalizes manual values and preserves an explicit empty value for clearing", () => {
    expect(normalizeTrackingDraft({ source: "  Meta ", campaign: "", isOrganic: "yes" })).toEqual({
      source: "Meta",
      campaign: null,
      isOrganic: true,
    });
  });

  it("merges the stored override without changing the automatic snapshot", () => {
    expect(mergeManualTracking({ campaign: "Automática", platform: "Meta" }, { campaign: "Manual" })).toEqual({
      campaign: "Manual",
      platform: "Meta",
    });
  });
});
