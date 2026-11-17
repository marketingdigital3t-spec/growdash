import { describe, expect, it } from "vitest";

function clampLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 1000);
}

function clampOffset(offset: number): number {
  return Math.max(offset, 0);
}

function calculateHasMore(count: number | null, offset: number, pageLength: number) {
  const totalRemaining = Number(count ?? 0) - offset - pageLength;
  return { totalRemaining, hasMore: totalRemaining > 0 };
}

describe("rd-enrich-states pagination", () => {
  it("clamps limit between 1 and 1000", () => {
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(200)).toBe(200);
    expect(clampLimit(2000)).toBe(1000);
    expect(Number.isNaN(clampLimit(NaN))).toBe(true);
  });

  it("clamps offset to non-negative", () => {
    expect(clampOffset(-1)).toBe(0);
    expect(clampOffset(0)).toBe(0);
    expect(clampOffset(800)).toBe(800);
  });

  it("reports hasMore when there are remaining deals", () => {
    expect(calculateHasMore(2744, 0, 200)).toEqual({ totalRemaining: 2544, hasMore: true });
    expect(calculateHasMore(2744, 2544, 200)).toEqual({ totalRemaining: 0, hasMore: false });
    expect(calculateHasMore(null, 0, 200)).toEqual({ totalRemaining: -200, hasMore: false });
    expect(calculateHasMore(100, 0, 200)).toEqual({ totalRemaining: -100, hasMore: false });
  });
});
