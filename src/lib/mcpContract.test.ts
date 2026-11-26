import { describe, expect, it } from "vitest";
import { civilDateRangeToUtc, decodeMcpCursor, encodeMcpCursor, isValidCivilDate, isValidDateRange, isValidUuid, parseMcpLimit } from "../../supabase/functions/_shared/mcpContract";

describe("MCP contract validation", () => {
  it("accepts only real civil dates and ordered inclusive ranges", () => {
    expect(isValidCivilDate("2026-02-28")).toBe(true);
    expect(isValidCivilDate("2026-02-30")).toBe(false);
    expect(isValidDateRange("2026-10-01", "2026-10-31")).toBe(true);
    expect(isValidDateRange("2026-11-01", "2026-10-31")).toBe(false);
  });

  it("accepts only UUIDs and bounded integer limits", () => {
    expect(isValidUuid("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isValidUuid("account-1")).toBe(false);
    expect(parseMcpLimit(undefined)).toBe(100);
    expect(parseMcpLimit(500)).toBe(500);
    expect(parseMcpLimit(501)).toBeNull();
    expect(parseMcpLimit("100")).toBeNull();
  });

  it("round-trips an opaque cursor without trusting client SQL", () => {
    const cursor = encodeMcpCursor({ firstReceivedAt: "2026-10-26T15:00:00.000Z", id: "00000000-0000-4000-8000-000000000001" });
    expect(cursor).not.toContain("00000000-0000-4000-8000-000000000001");
    expect(decodeMcpCursor(cursor)).toEqual({ firstReceivedAt: "2026-10-26T15:00:00.000Z", id: "00000000-0000-4000-8000-000000000001" });
    expect(decodeMcpCursor("not-a-cursor")).toBeNull();
    expect(decodeMcpCursor(encodeUnsafeCursor({ first_received_at: "2026-10-26T15:00:00.000Z", id: "lead-1" }))).toBeNull();
  });

  it("converts an inclusive civil range using the requested account timezone", () => {
    expect(civilDateRangeToUtc("2026-10-01", "2026-10-31", "America/Sao_Paulo")).toEqual({
      start: "2026-10-01T03:00:00.000Z",
      endExclusive: "2026-11-01T03:00:00.000Z",
    });
  });
});

function encodeUnsafeCursor(value: unknown) {
  return btoa(JSON.stringify({ v: 1, ...value })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
