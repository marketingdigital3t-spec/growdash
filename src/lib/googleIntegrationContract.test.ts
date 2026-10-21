import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supabaseConfig = readFileSync(new URL("../../supabase/config.toml", import.meta.url), "utf8");

function functionConfig(name: string) {
  const match = supabaseConfig.match(new RegExp(`\\[functions\\.${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\]\\s*\\nverify_jwt\\s*=\\s*(true|false)`, "m"));
  return match?.[1] ?? null;
}

describe("Google Workspace Edge Function contract", () => {
  it("publishes the OAuth callback and protects authenticated Google operations", () => {
    expect(functionConfig("google-workspace-oauth-start")).toBe("true");
    expect(functionConfig("google-workspace-oauth-callback")).toBe("false");
    expect(functionConfig("google-drive-files")).toBe("true");
    expect(functionConfig("google-gmail-send")).toBe("true");
  });
});
