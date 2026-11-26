import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const widgetSource = readFileSync(
  new URL("../components/dashboard/widgets/FinancialOverviewWidgets.tsx", import.meta.url),
  "utf8",
);
const legacySource = readFileSync(
  new URL("../components/dashboard/widgets/DefaultDashboardContent.tsx", import.meta.url),
  "utf8",
);

describe("Distribuição por Plataforma — segmented control", () => {
  it("renders the segment group without its own border in both widget implementations", () => {
    expect(widgetSource).toContain("gd-platform-segments");
    expect(legacySource).toContain("gd-platform-segments");
    // The group must carry an explicit zero border width: the inherited
    // rounded border is what drew the frame around the segments.
    expect(widgetSource).toMatch(/TabsList className="[^"]*border-0[^"]*"/);
    expect(legacySource).toMatch(/TabsList className="[^"]*border-0[^"]*"/);
  });

  it("keeps the segment group free of the emerald card border contract", () => {
    expect(indexCss).toMatch(
      /\.brand-shell :is\([\s\S]*?\.gd-platform-segments[\s\S]*?border:\s*0\s*!important/,
    );
  });

  it("keeps inactive segments transparent so the group reads as one rail", () => {
    expect(indexCss).toMatch(
      /\.gd-platform-segments \[role="tab"\]:not\(\[data-state="active"\]\)[\s\S]*?background:\s*transparent\s*!important/,
    );
  });
});
