import { describe, expect, it } from "vitest";
import { ensureDefaultDashboardContent } from "@/lib/dashboardViewDefaults";

describe("ensureDefaultDashboardContent", () => {
  it("restaura o dashboard padrão no topo e preserva widgets personalizados", () => {
    const view = {
      id: "view-1",
      widgets: [{ id: "custom", type: "kpi", title: "KPI", config: {} }],
      layout: [{ i: "custom", x: 0, y: 2, w: 3, h: 2 }],
    };

    const restored = ensureDefaultDashboardContent(view);

    expect(restored.widgets.map((widget) => widget.id)).toEqual([
      "primary-revenue", "primary-spend", "primary-roas", "primary-profit", "default", "custom",
    ]);
    expect(restored.layout[0]).toMatchObject({ i: "primary-revenue", x: 0, y: 0, w: 3 });
    expect(restored.layout[4]).toMatchObject({ i: "default", x: 0, y: 2, w: 12 });
    expect(restored.layout[5]).toMatchObject({ i: "custom", y: 35 });
  });

  it("migra uma vez o bloco legado e depois preserva a edição individual", () => {
    const view = {
      id: "view-2",
      widgets: [{ id: "default", type: "default_block", title: "Padrão", config: {} }],
      layout: [{ i: "default", x: 0, y: 0, w: 12, h: 30 }],
    };

    const migrated = ensureDefaultDashboardContent(view);
    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      hidePrimary: true,
      individualized: true,
    });
    expect(ensureDefaultDashboardContent(migrated)).toBe(migrated);
  });
});
