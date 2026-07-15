import { useCallback } from "react";
import type { DrawElement, Point, ToolType } from "../types";
import { createId, snapPoint } from "../utils/geometry";

const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  text: { width: 220, height: 72 },
  sticky: { width: 220, height: 180 },
  image: { width: 300, height: 200 },
};

export function createDrawElement(tool: ToolType, point: Point, layerIndex: number, snapToGrid: boolean): DrawElement | null {
  if (tool === "select" || tool === "hand" || tool === "image") return null;
  const origin = snapPoint(point, snapToGrid);
  const size = DEFAULT_SIZE[tool] || { width: 0, height: 0 };
  const sticky = tool === "sticky";
  const text = tool === "text";
  return {
    id: createId(tool),
    type: tool,
    x: origin.x,
    y: origin.y,
    width: size.width,
    height: size.height,
    rotation: 0,
    opacity: 1,
    fillColor: sticky ? "#fbbf24" : text || tool === "line" || tool === "arrow" || tool === "freehand" ? "transparent" : "#211b10",
    strokeColor: sticky ? "#f59e0b" : "#F5A623",
    strokeWidth: 2,
    points: tool === "freehand" ? [{ x: 0, y: 0 }] : undefined,
    text: sticky ? "Digite sua nota…" : text ? "Texto" : undefined,
    fontSize: sticky ? 20 : 22,
    fontFamily: "Nunito, Inter, system-ui, sans-serif",
    layerIndex,
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function useDrawing() {
  const moveElements = useCallback((elements: DrawElement[], selectedIds: readonly string[], delta: Point, snapToGrid: boolean) => elements.map((element) => {
    if (!selectedIds.includes(element.id) || element.locked) return element;
    const next = snapPoint({ x: element.x + delta.x, y: element.y + delta.y }, snapToGrid);
    return { ...element, ...next, updatedAt: new Date().toISOString() };
  }), []);

  return { createDrawElement, moveElements };
}
