import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const crmPage = readFileSync(
  fileURLToPath(new URL("../../growdash/CrmPage.tsx", import.meta.url)),
  "utf8",
);

const crmCss = readFileSync(
  fileURLToPath(new URL("../../index.css", import.meta.url)),
  "utf8",
);

describe("CRM summary cards and filter layout", () => {
  it("gives every metric card the same fixed layout rows", () => {
    expect(crmPage).toContain("min-h-[174px]");
    expect(crmPage).toContain("min-h-[68px]");
    expect(crmPage).toContain("mt-auto line-clamp-2 min-h-8");
  });

  it("organizes filters into explicit search, scope, and status rows", () => {
    expect(crmPage).toContain('className="crm-filter-row crm-filter-row-primary"');
    expect(crmPage).toContain('className="crm-filter-row crm-filter-row-secondary"');
    expect(crmPage).toContain("crm-filter-strip");
  });

  it("defines responsive filter rows and control styles directly", () => {
    expect(crmCss).toContain(".crm-filter-row-primary");
    expect(crmCss).toContain(".crm-filter-row-secondary");
    expect(crmCss).toContain(".crm-filter-control");
  });
});

export {};
