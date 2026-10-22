import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(
  fileURLToPath(new URL("../index.css", import.meta.url)),
  "utf8",
);

describe("dark campaign color contract", () => {
  it("keeps result controls and sticky totals readable in dark mode", () => {
    expect(indexCss).toContain(
      'html.dark body .brand-shell:has(.traffic-page-shell) .campaigns-workspace [data-campaign-table-scroll] tbody tr > td button[aria-label*="resultado"]',
    );
    expect(indexCss).toContain(
      "html.dark body .brand-shell:has(.traffic-page-shell) .campaigns-workspace [data-campaign-totals] > td",
    );
    expect(indexCss).toContain(
      "html.dark body .brand-shell:has(.traffic-page-shell) .campaigns-workspace .campaign-row-actions",
    );
    expect(indexCss).toContain(
      "html.dark body .brand-shell:has(.traffic-page-shell) .campaigns-workspace .campaign-status-cell > button",
    );
  });
});
