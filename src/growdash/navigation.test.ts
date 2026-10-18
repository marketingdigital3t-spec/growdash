import { describe, expect, it } from "vitest";
import { ALL_MODULES, findModule, NAV_SECTIONS } from "./navigation";

describe("Growdash sidebar navigation", () => {
  it("keeps Intelligence available only inside Campaigns, not in the sidebar", () => {
    expect(ALL_MODULES.some((module) => module.label === "Intelligence")).toBe(false);
  });

  it("keeps the functional modules while keeping Commercial visible", () => {
    expect(ALL_MODULES.some((module) => module.label === "Tráfego Pago" && module.path === "/campanhas")).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Comercial" && module.path === "/comercial")).toBe(true);
    expect(["Growdash Flow", "Análise de Mídia Social", "Alertas", "Leads incompletos", "Automação"]
      .every((label) => ALL_MODULES.some((module) => module.label === label))).toBe(true);
    expect(ALL_MODULES.some((module) => module.label === "Quadro")).toBe(false);
    expect(ALL_MODULES.some((module) => module.label === "Automação" && module.external && module.path === "https://automation.growdash.com.br")).toBe(true);
  });

  it("uses a unique route for every sidebar item", () => {
    const paths = ALL_MODULES.map((module) => module.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps the core intelligence modules together", () => {
    const intelligence = NAV_SECTIONS.find((section) => section.label === "Inteligência");
    const labels = intelligence?.items.map((item) => item.label) ?? [];
    expect(labels.indexOf("Análise de Funis")).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf("Tráfego Pago")).toBeGreaterThan(labels.indexOf("Análise de Funis"));
    expect(labels.indexOf("Business")).toBeGreaterThan(labels.indexOf("Análise de Funis"));
  });

  it("keeps sidebar section labels tied to their section instead of filtered position", () => {
    expect(NAV_SECTIONS.map((section) => section.sidebarLabel)).toEqual([
      "MISSÃO",
      "NAVE",
      "TRIPULAÇÃO",
      "GESTÃO",
      "ADMINISTRAÇÃO",
    ]);

    const visibleSections = NAV_SECTIONS.filter((section) => section.label !== "Visão geral");
    expect(visibleSections.map((section) => section.sidebarLabel)).toEqual([
      "NAVE",
      "TRIPULAÇÃO",
      "GESTÃO",
      "ADMINISTRAÇÃO",
    ]);
  });

  it("resolves content for every sidebar destination", () => {
    for (const module of ALL_MODULES) {
      expect(findModule(module.path)?.label).toBe(module.label);
    }
  });
});
