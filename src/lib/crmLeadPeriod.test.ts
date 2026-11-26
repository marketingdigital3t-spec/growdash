import { describe, expect, it } from "vitest";
import { crmLeadDateBounds } from "../../supabase/functions/_shared/crmLeadPeriod";

describe("CRM lead civil period bounds", () => {
  it("uses the workspace timezone for an inclusive Sao Paulo period", () => {
    expect(crmLeadDateBounds("2026-10-01", "2026-10-31", "America/Sao_Paulo")).toEqual({
      start: "2026-10-01T03:00:00.000Z",
      endExclusive: "2026-11-01T03:00:00.000Z",
    });
  });

  it("preserves one-sided civil filters", () => {
    expect(crmLeadDateBounds("2026-10-01", null, "America/Sao_Paulo")).toEqual({
      start: "2026-10-01T03:00:00.000Z",
      endExclusive: null,
    });
    expect(crmLeadDateBounds(null, "2026-10-31", "America/Sao_Paulo")).toEqual({
      start: null,
      endExclusive: "2026-11-01T03:00:00.000Z",
    });
  });
});
