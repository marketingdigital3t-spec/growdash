import { describe, expect, it } from "vitest";
import {
  buildResponsiveDashboardLayout,
  findDashboardSlot,
  normalizeDesktopDashboardLayout,
} from "./responsiveDashboardLayout";

describe("responsive dashboard layout", () => {
  it("recovers KPI cards saved as a single desktop lane", () => {
    const widgets = [0, 1, 2, 3].map((index) => ({ id: `kpi-${index}`, type: "kpi" }));
    const layout = widgets.map((widget, index) => ({ i: widget.id, x: 0, y: index * 2, w: 6, h: 2 }));

    const recovered = normalizeDesktopDashboardLayout(layout, widgets, 12);

    expect(recovered.map(({ x, y, w }) => ({ x, y, w }))).toEqual([
      { x: 0, y: 0, w: 3 },
      { x: 3, y: 0, w: 3 },
      { x: 6, y: 0, w: 3 },
      { x: 9, y: 0, w: 3 },
    ]);
  });

  it("creates independent tablet layouts without changing desktop coordinates", () => {
    const desktop = [
      { i: "a", x: 0, y: 0, w: 3, h: 2 },
      { i: "b", x: 3, y: 0, w: 3, h: 2 },
      { i: "chart", x: 0, y: 2, w: 12, h: 4 },
    ];

    const tablet = buildResponsiveDashboardLayout(desktop, 12, 8);

    expect(tablet.map(({ x, y, w }) => ({ x, y, w }))).toEqual([
      { x: 0, y: 0, w: 4 },
      { x: 4, y: 0, w: 4 },
      { x: 0, y: 2, w: 8 },
    ]);
    expect(desktop[1].x).toBe(3);
  });

  it("places a new widget in the first free horizontal slot", () => {
    const existing = [
      { i: "a", x: 0, y: 0, w: 3, h: 2 },
      { i: "b", x: 3, y: 0, w: 3, h: 2 },
    ];

    expect(findDashboardSlot(existing, 3, 2, 12)).toEqual({ x: 6, y: 0 });
  });
});
