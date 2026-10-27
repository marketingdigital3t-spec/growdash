import { describe, expect, it } from "vitest";
import { SUPABASE_PUBLIC_KEY } from "./client";

describe("Supabase browser client key", () => {
  it("uses the current publishable key format", () => {
    expect(SUPABASE_PUBLIC_KEY).toMatch(/^sb_publishable_/);
  });
});
