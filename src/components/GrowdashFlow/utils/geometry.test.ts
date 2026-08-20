import { describe, expect, it } from "vitest";
import type { DrawElement } from "../types";
import { connectorPoints, fitTextElementToContent, getSelectionBounds, keepTextContentVisible, minimumTextElementHeight, minimumTextElementWidth, normalizeAutoTextElements, snapPoint } from "./geometry";

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

  it("keeps text boxes tall enough for the selected type size and wrapped copy", () => {
    const text: DrawElement = { id: "headline", type: "text", x: 0, y: 0, width: 220, height: 20, rotation: 0, opacity: 1, fillColor: "transparent", strokeColor: "#fff", strokeWidth: 2, text: "ENGAJAMENTO\nObjeção", fontSize: 40, layerIndex: 0, locked: false };
    expect(minimumTextElementHeight(text)).toBeGreaterThan(100);
    expect(keepTextContentVisible(text).height).toBe(minimumTextElementHeight(text));
  });

  it("keeps compact labels readable and grows them for long copy", () => {
    const cramped: DrawElement = { id: "note", type: "text", x: 0, y: 0, width: 100, height: 32, rotation: 0, opacity: 1, fillColor: "transparent", strokeColor: "#fff", strokeWidth: 2, text: "Uma orientação longa para validar que o conteúdo não fica cortado dentro do quadro de texto.", fontSize: 22, layerIndex: 0, locked: false };
    const visible = keepTextContentVisible(cramped);
    expect(visible.width).toBe(100);
    expect(visible.height).toBeGreaterThanOrEqual(52);
    expect(visible.height).toBeGreaterThan(cramped.height);
  });

  it("fits a plain text label to its content instead of creating a large card", () => {
    const label: DrawElement = { id: "label", type: "text", x: 0, y: 0, width: 340, height: 116, rotation: 0, opacity: 1, fillColor: "transparent", strokeColor: "#fff", strokeWidth: 2, text: "Texto", fontSize: 18, layerIndex: 0, locked: false };
    const fitted = fitTextElementToContent(label);
    expect(fitted.width).toBeLessThan(120);
    expect(fitted.height).toBeLessThan(64);
  });

  it("compacts legacy text labels but respects a width deliberately set by the author", () => {
    const legacy: DrawElement = { id: "legacy", type: "text", x: 0, y: 0, width: 210, height: 81, rotation: 0, opacity: 1, fillColor: "transparent", strokeColor: "#fff", strokeWidth: 2, text: "Texto", fontSize: 18, layerIndex: 0, locked: false };
    const manual = { ...legacy, id: "manual", autoSize: false };
    const [fitted, preserved] = normalizeAutoTextElements([legacy, manual]);
    expect(fitted.width).toBeLessThan(120);
    expect(fitted.height).toBeLessThan(64);
    expect(preserved.width).toBe(210);
    expect(preserved.height).toBe(81);
  });
});
