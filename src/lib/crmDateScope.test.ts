import { describe, expect, it } from "vitest";
import { isRDDealInCrmPeriod } from "./crmDateScope";

const start = new Date("2026-08-01T00:00:00-03:00");
const end = new Date("2026-08-10T00:00:00-03:00");

describe("CRM date scope", () => {
  it("counts a negotiation created in the selected interval", () => {
    expect(isRDDealInCrmPeriod({ lead_created_at: "2026-08-05T12:00:00-03:00" }, start, end)).toBe(true);
  });
  it("counts an older negotiation when it closes in the selected interval", () => {
    expect(isRDDealInCrmPeriod({ lead_created_at: "2026-07-01T12:00:00-03:00", closed_at: "2026-08-06T12:00:00-03:00" }, start, end)).toBe(true);
  });

  it("does not include a deal outside both creation and closing dates", () => {
    expect(isRDDealInCrmPeriod({ lead_created_at: "2026-07-01T12:00:00-03:00", closed_at: "2026-07-05T12:00:00-03:00" }, start, end)).toBe(false);
  });

  it("uses stage movement only for legacy records without operational dates", () => {
    expect(isRDDealInCrmPeriod({ stage_updated_at: "2026-08-08T12:00:00-03:00" }, start, end)).toBe(true);
  });

  it("keeps a won RD deal whose closed_at is missing but stage moved in the period", () => {
    expect(isRDDealInCrmPeriod({
      win: true,
      lead_created_at: "2026-08-01T12:00:00Z",
      closed_at: null,
      stage_updated_at: "2026-09-10T12:00:00Z",
    }, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-30T23:59:59Z"))).toBe(true);
  });
});
