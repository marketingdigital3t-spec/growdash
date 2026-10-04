import { describe, expect, it } from "vitest";
import { filterMetaBreakdownsByAttribution } from "./metaBreakdownScope";

describe("filterMetaBreakdownsByAttribution", () => {
  it("does not mix snapshots from another attribution window", () => {
    const rows = [
      { campaign_id: "c1", attribution_window: "account_default", spend: 10 },
      { campaign_id: "c1", attribution_window: "7d_click,1d_view", spend: 20 },
      { campaign_id: "c2", attribution_window: null, spend: 30 },
    ];

    expect(filterMetaBreakdownsByAttribution(rows, {
      c1: "7d_click,1d_view",
      c2: "account_default",
    })).toEqual([rows[1], rows[2]]);
  });

  it("keeps legacy null windows only for account_default", () => {
    const rows = [{ campaign_id: "c1", attribution_window: null }];
    expect(filterMetaBreakdownsByAttribution(rows, { c1: "account_default" })).toEqual(rows);
    expect(filterMetaBreakdownsByAttribution(rows, { c1: "7d_click" })).toEqual([]);
  });
});
