import { describe, expect, it } from "vitest";
import { dedupeDailyInsights } from "./useInsights";

describe("daily insight scope", () => {
  it("deduplicates retries without collapsing different attribution windows", () => {
    const rows: any[] = [
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "7d_click", spend: 10 },
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "7d_click", spend: 10 },
      { ad_id: "ad-1", date: "2026-09-30", attribution_window: "1d_view", spend: 3 },
    ];
    expect(dedupeDailyInsights(rows)).toHaveLength(2);
  });
});
