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

    expect(restored.widgets.map((widget) => widget.id)).toEqual(["default", "custom"]);
    expect(restored.layout[0]).toMatchObject({ i: "default", x: 0, y: 0, w: 12 });
    expect(restored.layout[1]).toMatchObject({ i: "custom", y: 33 });
  });

  it("não altera uma visualização que já possui o bloco padrão", () => {
    const view = {
      id: "view-2",
      widgets: [{ id: "default", type: "default_block", title: "Padrão", config: {} }],
      layout: [{ i: "default", x: 0, y: 0, w: 12, h: 30 }],
    };

    expect(ensureDefaultDashboardContent(view)).toBe(view);
  });
});
