import { describe, expect, it } from "vitest";
import { classifyWatermark, mergeHealthStatuses, percentile } from "./platformHealth";

describe("platform health", () => {
  it("classifies freshness without turning missing data into zero", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(classifyWatermark(null, "idle", now)).toBe("no_data");
    expect(classifyWatermark("2026-10-18T11:50:00Z", "completed", now)).toBe("fresh");
    expect(classifyWatermark("2026-10-18T11:00:00Z", "completed", now)).toBe("stale");
    expect(classifyWatermark("2026-10-18T11:50:00Z", "partial", now)).toBe("degraded");
  });

  it("combines source states by worst known condition", () => {
    expect(mergeHealthStatuses(["fresh", "stale"])).toBe("stale");
    expect(mergeHealthStatuses(["fresh", "degraded"])).toBe("degraded");
    expect(mergeHealthStatuses(["no_data"])).toBe("no_data");
  });

  it("computes a stable p95 for observed durations", () => {
    expect(percentile([10, 20, 30, 40], 0.95)).toBe(40);
    expect(percentile([], 0.95)).toBeNull();
  });
});
