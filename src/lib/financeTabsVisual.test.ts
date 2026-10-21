import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const stylesheet = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("Finance tabs visual contract", () => {
  it("keeps the selected tab emerald instead of the legacy blue primary", () => {
    expect(stylesheet).toContain('.brand-shell .finance-page [role="tab"][data-state="active"]');
    expect(stylesheet).toContain("background: var(--gd-accent) !important;");
    expect(stylesheet).toContain("color: #062015 !important;");
  });

  it("keeps the unselected tab strip neutral", () => {
    expect(stylesheet).toContain('.brand-shell .finance-page [role="tablist"]');
    expect(stylesheet).toContain("background: var(--gd-content-panel) !important;");
    expect(stylesheet).toContain("color: var(--gd-content-muted) !important;");
  });
});
