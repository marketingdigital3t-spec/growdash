import { describe, expect, it } from "vitest";
import { parsePlausibleDate } from "./safeDate";

describe("safe provider dates", () => {
  it("rejects epoch timestamps left by legacy token rows", () => {
    expect(parsePlausibleDate("1969-12-31T23:00:00.000Z")).toBeNull();
    expect(parsePlausibleDate("1970-01-01T00:00:00.000Z")).toBeNull();
  });

  it("preserves valid provider timestamps", () => {
    expect(parsePlausibleDate("2026-10-27T12:00:00.000Z")?.toISOString()).toBe("2026-10-27T12:00:00.000Z");
    expect(parsePlausibleDate("not-a-date")).toBeNull();
  });
});
