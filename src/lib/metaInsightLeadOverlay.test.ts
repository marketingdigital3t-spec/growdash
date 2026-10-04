import { describe, expect, it } from "vitest";
import { overlayCanonicalMetaLeads } from "@/lib/metaInsightLeadOverlay";

describe("overlayCanonicalMetaLeads", () => {
  it("replaces stale legacy values with forms + site + conversations once per ad", () => {
    const rows = [
      { ad_id: "ad-1", leads: 99, date: "2026-10-02" },
      { ad_id: "ad-1", leads: 99, date: "2026-10-01" },
      { ad_id: "ad-2", leads: 7, date: "2026-10-02" },
    ] as any;
    expect(overlayCanonicalMetaLeads(rows, {
      "ad-1": { forms: 3, site: 1, conversations: 2, total: 6 },
      "ad-2": { forms: 0, site: 0, conversations: 0, total: 0 },
    }).map((row) => row.leads)).toEqual([6, 0, 0]);
  });

  it("does not invent a legacy lead total when canonical action rows are absent", () => {
    expect(overlayCanonicalMetaLeads([{ ad_id: "ad-1", leads: 12 } as any], {}).map((row) => row.leads)).toEqual([0]);
  });
});
