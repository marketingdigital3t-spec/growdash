import { describe, expect, it } from "vitest";
import type { FlowData } from "../types";
import { flowToSvg } from "./export";

describe("Growdash Flow export", () => {
  it("keeps multiline sticky text readable in SVG output", () => {
    const flow: FlowData = {
      version: 1,
      elements: [{
        id: "sticky",
        type: "sticky",
        x: 10,
        y: 20,
        width: 180,
        height: 120,
        rotation: 0,
        opacity: 1,
        fillColor: "#12223f",
        strokeColor: "#6f9cff",
        strokeWidth: 2,
        text: "PÚBLICO\nQualificado",
        fontSize: 16,
        layerIndex: 1,
        locked: false,
      }],
      zoom: 1,
      panOffset: { x: 0, y: 0 },
      showGrid: true,
      snapToGrid: false,
      updatedAt: new Date(0).toISOString(),
    };

    const svg = flowToSvg(flow);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('<tspan');
    expect(svg).toContain("Qualificado");
  });
});
