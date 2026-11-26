import { describe, expect, it } from "vitest";
import { excalidrawToFlow, flowToExcalidraw, isCompatibleFlow } from "./excalidrawAdapter";
import type { FlowData } from "./types";

const flow: FlowData = {
  version: 1,
  zoom: 0.8,
  panOffset: { x: 12, y: -4 },
  showGrid: true,
  snapToGrid: false,
  updatedAt: "2026-10-23T00:00:00.000Z",
  elements: [{ id: "a", type: "sticky", x: 10, y: 20, width: 220, height: 120, rotation: 0, opacity: 1, fillColor: "#fbbf24", strokeColor: "#111827", strokeWidth: 2, text: "Lead\nQualificado", layerIndex: 0, locked: true }],
};

describe("Growdash Flow Excalidraw adapter", () => {
  it("converts shapes and bound text into an Excalidraw scene", () => {
    const scene = flowToExcalidraw(flow);
    expect(scene.elements).toHaveLength(2);
    expect(scene.elements[0].customData?.growdashId).toBe("a");
    expect((scene.elements[1] as any).text).toBe("Lead\nQualificado");
  });

  it("round trips Growdash metadata and text", () => {
    const restored = excalidrawToFlow(flowToExcalidraw(flow), flow);
    expect(restored.elements[0].id).toBe("a");
    expect(restored.elements[0].text).toBe("Lead\nQualificado");
    expect(restored.elements[0].locked).toBe(true);
    expect(restored.panOffset).toEqual(flow.panOffset);
  });

  it("accepts only the current FlowData contract", () => {
    expect(isCompatibleFlow(flow)).toBe(true);
    expect(isCompatibleFlow({ version: 2, elements: [] })).toBe(false);
  });
});
