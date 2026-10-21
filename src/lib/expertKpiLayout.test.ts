import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const metricCardSource = readFileSync(new URL("../components/dashboard/MetricCard.tsx", import.meta.url), "utf8");
const expertDashboardSource = readFileSync(new URL("../pages/ExpertDashboard.tsx", import.meta.url), "utf8");
const indexCss = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("Expert dashboard KPI layout contract", () => {
  it("keeps metric values on one line and scales long values", () => {
    expect(metricCardSource).toContain("whitespace-nowrap");
    expect(metricCardSource).not.toContain("break-words font-bold leading-tight tabular-nums");
    expect(indexCss).toContain(".expert-dashboard .dashboard-terra-metric-value");
  });

  it("uses a deliberate responsive grid for the ten KPI cards", () => {
    expect(indexCss).toMatch(/@media \(min-width: 1440px\)[\s\S]*?\.expert-dashboard \.expert-kpi-grid[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/);
    expect(indexCss).toMatch(/@media \(min-width: 1200px\) and \(max-width: 1439px\)[\s\S]*?\.expert-dashboard \.expert-kpi-grid[\s\S]*?repeat\(4, minmax\(0, 1fr\)\)/);
    expect(indexCss).toMatch(/@media \(min-width: 768px\) and \(max-width: 1199px\)[\s\S]*?\.expert-dashboard \.expert-kpi-grid[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
    expect(indexCss).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.expert-dashboard \.expert-kpi-grid[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
    expect(indexCss).toMatch(/@media \(max-width: 479px\)[\s\S]*?\.expert-dashboard \.expert-kpi-grid[\s\S]*?repeat\(1, minmax\(0, 1fr\)\)/);
  });

  it("uses a centered desktop shell and named sections for aligned composition", () => {
    expect(expertDashboardSource).toContain("expert-dashboard-shell");
    expect(expertDashboardSource).toContain("expert-dashboard-header");
    expect(expertDashboardSource).toContain("expert-charts-grid");
    expect(expertDashboardSource).toContain("expert-operations-layout");
    expect(indexCss).toMatch(/\.expert-dashboard-shell[\s\S]*?max-width:\s*1680px/);
    expect(indexCss).toMatch(/\.expert-dashboard \.expert-charts-grid[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.05fr\) minmax\(0, 0\.95fr\)/);
  });

  it("keeps five KPI columns on wide desktop without stretching the page", () => {
    expect(indexCss).toMatch(/@media \(min-width: 1440px\)[\s\S]*?\.expert-dashboard \.expert-kpi-grid[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)/);
  });
});
