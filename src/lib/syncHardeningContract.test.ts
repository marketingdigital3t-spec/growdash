import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("sync hardening contracts", () => {
  it("authenticates the Meta cron path without direct secret equality", () => {
    const source = read("supabase/functions/sync-meta-insights/index.ts");
    expect(source).toContain('import { secretsMatch } from "../_shared/secretsMatch.ts";');
    expect(source).toContain("secretsMatch(bearer, supabaseServiceKey)");
    expect(source).not.toContain("bearer === supabaseServiceKey");
  });

  it("bounds every Gmail provider request", () => {
    const source = read("supabase/functions/google-gmail-send/index.ts");
    expect(source).toContain("import { fetchWithTimeout } from \"../../../src/lib/syncReliabilityPolicy.ts\";");
    expect(source).toContain("fetchWithTimeout(");
    expect(source).not.toMatch(/\bfetch\(\"https:\/\/gmail\.googleapis\.com/);
  });

  it("uses the publishable-key format in the environment example", () => {
    const source = read(".env.example");
    expect(source).toMatch(/^VITE_SUPABASE_PUBLISHABLE_KEY=\"sb_publishable_[^\"]+\"$/m);
  });
});
