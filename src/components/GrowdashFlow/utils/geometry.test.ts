import { describe, expect, it } from "vitest";
import type { DrawElement } from "../types";
import { connectorPoints, getSelectionBounds, snapPoint } from "./geometry";

function rectangle(id: string, x: number, y: number): DrawElement {
  return { id, type: "rectangle", x, y, width: 100, height: 80, rotation: 0, opacity: 1, fillColor: "#121212", strokeColor: "#F5A623", strokeWidth: 2, layerIndex: 0, locked: false };
}

describe("Growdash Flow geometry", () => {
  it("keeps a bound arrow attached when its shapes move", () => {
    const source = rectangle("source", 20, 30);
    const target = rectangle("target", 300, 200);
    const arrow: DrawElement = { id: "arrow", type: "arrow", x: 0, y: 0, width: 0, height: 0, rotation: 0, opacity: 1, fillColor: "transparent", strokeColor: "#F5A623", strokeWidth: 2, layerIndex: 1, locked: false, startBinding: { elementId: source.id, anchor: "e" }, endBinding: { elementId: target.id, anchor: "w" } };
    expect(connectorPoints(arrow, [source, target, arrow])).toEqual({ start: { x: 120, y: 70 }, end: { x: 300, y: 240 } });
    const movedTarget = { ...target, x: 500, y: 400 };
    expect(connectorPoints(arrow, [source, movedTarget, arrow]).end).toEqual({ x: 500, y: 440 });
  });

  it("calculates multi-selection bounds and optional grid snapping", () => {
    expect(getSelectionBounds([rectangle("one", 20, 30), rectangle("two", 300, 200)], ["one", "two"])).toEqual({ x: 20, y: 30, width: 380, height: 250 });
    expect(snapPoint({ x: 29, y: 51 }, true, 20)).toEqual({ x: 20, y: 60 });
    expect(snapPoint({ x: 29, y: 51 }, false, 20)).toEqual({ x: 29, y: 51 });
  });
});
