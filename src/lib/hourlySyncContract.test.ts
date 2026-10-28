import { describe, expect, it } from "vitest";
import { filterHourlyFactsByRange, missingHourlyFactKeys, staleHourlyAdIds } from "./hourlySyncContract";

describe("hourly sync contract", () => {
  it("rejects provider rows outside the requested civil period", () => {
    const result = filterHourlyFactsByRange([
      { ad_id: "ad-1", date: "2026-10-28", hour: 9 },
      { ad_id: "ad-1", date: "2026-08-31", hour: 9 },
    ], "2026-10-28", "2026-10-28");

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });

  it("detects keys that the database did not confirm after upsert", () => {
    const missing = missingHourlyFactKeys(
      [
        { ad_id: "ad-1", date: "2026-10-28", hour: 9 },
        { ad_id: "ad-1", date: "2026-10-28", hour: 10 },
      ],
      [{ ad_id: "ad-1", date: "2026-10-28", hour: 9 }],
    );

    expect(missing).toEqual([{ ad_id: "ad-1", date: "2026-10-28", hour: 10 }]);
  });

  it("returns only old ads for the post-write cleanup", () => {
    expect(staleHourlyAdIds(["ad-1", "ad-2", "ad-2"], ["ad-2"])).toEqual(["ad-1"]);
  });
});
