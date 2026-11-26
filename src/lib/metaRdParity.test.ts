import { describe, expect, it } from "vitest";
import { summarizeMetaRdParity } from "./metaRdParity";

describe("Meta/RD parity", () => {
  it("compares Meta only with RD deals that have confirmed attribution", () => {
    const result = summarizeMetaRdParity(10, [
      { rd_deal_id: "attributed", meta_attribution_status: "attributed", meta_ad_id: "ad-1" },
      { rd_deal_id: "organic", meta_is_organic: true },
      { rd_deal_id: "partial", meta_attribution_status: "partial", meta_campaign_id: "campaign-1" },
    ]);

    expect(result).toMatchObject({
      rdTotalLeads: 3,
      rdAttributedLeads: 1,
      rdUnmatchedLeads: 2,
      differencePercent: 90,
    });
  });

  it("does not report a false divergence when attributed RD matches Meta", () => {
    const result = summarizeMetaRdParity(2, [
      { rd_deal_id: "one", meta_attribution_status: "attributed" },
      { rd_deal_id: "two", meta_lead_id: "lead-2" },
      { rd_deal_id: "organic", meta_is_organic: true },
    ]);

    expect(result.differencePercent).toBe(0);
    expect(result.coveragePercent).toBe(100);
  });
});
