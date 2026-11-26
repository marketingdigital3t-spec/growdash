import { describe, expect, it } from "vitest";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./client";

describe("Supabase browser client key", () => {
  it("uses the current publishable key format", () => {
    expect(SUPABASE_PUBLIC_KEY).toMatch(/^sb_publishable_/);
  });

  it("never resolves to a placeholder host", () => {
    expect(SUPABASE_URL).not.toContain("your-project-ref");
    expect(SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  });

  it("never resolves to a placeholder publishable key", () => {
    expect(SUPABASE_PUBLIC_KEY).not.toContain("placeholder");
  });
});
