import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("sidebar layout contract", () => {
  it("does not override the responsive state width classes", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    expect(stylesheet).not.toMatch(/\.growdash-safe-sidebar\s*\{[^}]*?(?<!-)width\s*:/s);
  });
});
