import { describe, expect, it } from "vitest";
import { ensureDefaultDashboardContent } from "@/lib/dashboardViewDefaults";
import { DASHBOARD_CANONICAL_LAYOUT_VERSION } from "@/lib/widgetCatalog";

describe("ensureDefaultDashboardContent", () => {
  it("restaura o dashboard original e remove o catálogo duplicado de uma view legada", () => {
    const view = {
      id: "view-1",
      widgets: [{ id: "custom", type: "kpi", title: "KPI", config: {} }],
      layout: [{ i: "custom", x: 0, y: 2, w: 3, h: 2 }],
    };

    const restored = ensureDefaultDashboardContent(view);

    expect(restored.widgets.map((widget) => widget.id)).toEqual(["default"]);
    expect(restored.widgets[0].config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(restored.layout).toEqual([
      expect.objectContaining({ i: "default", x: 0, y: 0, w: 12, minW: 12 }),
    ]);
  });

  it("migra uma vez o bloco legado e estabiliza a visualização", () => {
    const view = {
      id: "view-2",
      widgets: [{ id: "default", type: "default_block", title: "Padrão", config: {} }],
      layout: [{ i: "default", x: 0, y: 0, w: 12, h: 30 }],
    };

    const migrated = ensureDefaultDashboardContent(view);
    expect(migrated.widgets.find((widget) => widget.id === "default")?.config).toMatchObject({
      canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION,
    });
    expect(ensureDefaultDashboardContent(migrated)).toBe(migrated);
  });

  it("preserva widgets adicionados depois da migração canônica", () => {
    const view = {
      id: "view-3",
      widgets: [
        {
          id: "default",
          type: "default_block",
          title: "Padrão",
          config: { canonicalLayoutVersion: DASHBOARD_CANONICAL_LAYOUT_VERSION },
        },
        { id: "custom", type: "kpi", title: "KPI", config: {} },
      ],
      layout: [
        { i: "default", x: 0, y: 0, w: 12, h: 30 },
        { i: "custom", x: 0, y: 31, w: 3, h: 2 },
      ],
    };

    expect(ensureDefaultDashboardContent(view)).toBe(view);
  });
});
