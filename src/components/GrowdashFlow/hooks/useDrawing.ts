import { useCallback } from "react";
import type { DrawElement, Point, ToolType } from "../types";
import { createId, fitTextElementToContent, minimumTextElementHeight, snapPoint } from "../utils/geometry";

const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  // Plain text is a compact label and expands only when its copy needs it.
  text: { width: 88, height: 52 },
  sticky: { width: 260, height: 180 },
  image: { width: 300, height: 200 },
};

function currentAccentColor() {
  if (typeof window === "undefined") return "#F5A623";
  return getComputedStyle(document.documentElement).getPropertyValue("--brand-gold").trim() || "#F5A623";
}

export function createDrawElement(tool: ToolType, point: Point, layerIndex: number, snapToGrid: boolean): DrawElement | null {
  if (tool === "select" || tool === "hand" || tool === "image") return null;
  const origin = snapPoint(point, snapToGrid);
  const size = DEFAULT_SIZE[tool] || { width: 0, height: 0 };
  const sticky = tool === "sticky";
  const text = tool === "text";
  const element: DrawElement = {
    id: createId(tool),
    type: tool,
    x: origin.x,
    y: origin.y,
    width: size.width,
    height: size.height,
    rotation: 0,
    opacity: 1,
    fillColor: sticky ? "#fbbf24" : text || tool === "line" || tool === "arrow" || tool === "freehand" ? "transparent" : "#211b10",
    strokeColor: sticky ? "#f59e0b" : currentAccentColor(),
    strokeWidth: 2,
    points: tool === "freehand" ? [{ x: 0, y: 0 }] : undefined,
    text: sticky ? "Digite sua nota…" : text ? "Texto" : undefined,
    fontSize: sticky ? 20 : 16,
    fontFamily: "Nunito, Inter, system-ui, sans-serif",
    layerIndex,
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (text) return fitTextElementToContent({ ...element, autoSize: true });
  return sticky ? { ...element, height: Math.max(element.height, minimumTextElementHeight(element)) } : element;
}

export function useDrawing() {
  const moveElements = useCallback((elements: DrawElement[], selectedIds: readonly string[], delta: Point, snapToGrid: boolean) => elements.map((element) => {
    if (!selectedIds.includes(element.id) || element.locked) return element;
    const next = snapPoint({ x: element.x + delta.x, y: element.y + delta.y }, snapToGrid);
    return { ...element, ...next, updatedAt: new Date().toISOString() };
  }), []);

  return { createDrawElement, moveElements };
}
