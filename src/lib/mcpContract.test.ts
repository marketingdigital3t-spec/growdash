import { describe, expect, it } from "vitest";
import { isValidCivilDate, isValidDateRange, isValidUuid, parseMcpLimit } from "../../supabase/functions/_shared/mcpContract";

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
});
