import { describe, expect, it } from "vitest";
import { ALL_MODULES, findModule, NAV_SECTIONS } from "./navigation";

describe("Growdash sidebar navigation", () => {
  it("keeps Intelligence available only inside Campaigns, not in the sidebar", () => {
    expect(ALL_MODULES.some((module) => module.label === "Intelligence")).toBe(false);
  });

  it("uses a unique route for every sidebar item", () => {
    const paths = ALL_MODULES.map((module) => module.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("places Business directly after Funnel Analysis", () => {
    const intelligence = NAV_SECTIONS.find((section) => section.label === "Inteligência");
    const labels = intelligence?.items.map((item) => item.label) ?? [];
    expect(labels.indexOf("Business")).toBe(labels.indexOf("Análise de Funis") + 1);
  });

  it("resolves content for every sidebar destination", () => {
    for (const module of ALL_MODULES) {
      expect(findModule(module.path)?.label).toBe(module.label);
    }
  });
});
