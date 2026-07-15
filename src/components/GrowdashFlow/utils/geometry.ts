import type { AnchorName, DrawElement, Point } from "../types";

export type Bounds = { x: number; y: number; width: number; height: number };

export function normalizeBounds(x: number, y: number, width: number, height: number): Bounds {
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

export function getElementBounds(element: DrawElement): Bounds {
  if (element.points?.length && element.type === "freehand") {
    const xs = element.points.map((point) => element.x + point.x);
    const ys = element.points.map((point) => element.y + point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }
  return normalizeBounds(element.x, element.y, element.width, element.height);
}

export function boundsFromPoints(start: Point, end: Point): Bounds {
  return normalizeBounds(start.x, start.y, end.x - start.x, end.y - start.y);
}

export function pointInBounds(point: Point, bounds: Bounds, padding = 0) {
  return point.x >= bounds.x - padding && point.x <= bounds.x + bounds.width + padding && point.y >= bounds.y - padding && point.y <= bounds.y + bounds.height + padding;
}

export function pointInElement(point: Point, element: DrawElement, padding = 6) {
  return pointInBounds(point, getElementBounds(element), padding);
}

export function boundsIntersect(a: Bounds, b: Bounds) {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function getSelectionBounds(elements: DrawElement[], selectedIds: readonly string[]): Bounds | null {
  const selected = elements.filter((element) => selectedIds.includes(element.id));
  if (!selected.length) return null;
  const bounds = selected.map(getElementBounds);
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function getAnchorPoint(element: DrawElement, anchor: AnchorName): Point {
  const bounds = getElementBounds(element);
  const points: Record<AnchorName, Point> = {
    n: { x: bounds.x + bounds.width / 2, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    e: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    s: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    w: { x: bounds.x, y: bounds.y + bounds.height / 2 },
    nw: { x: bounds.x, y: bounds.y },
  };
  return points[anchor];
}

export function nearestAnchor(element: DrawElement, point: Point): { anchor: AnchorName; point: Point } {
  const anchors: AnchorName[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  return anchors
    .map((anchor) => ({ anchor, point: getAnchorPoint(element, anchor) }))
    .sort((a, b) => Math.hypot(a.point.x - point.x, a.point.y - point.y) - Math.hypot(b.point.x - point.x, b.point.y - point.y))[0];
}

export function snapValue(value: number, gridSize = 20) {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point: Point, enabled: boolean, gridSize = 20): Point {
  return enabled ? { x: snapValue(point.x, gridSize), y: snapValue(point.y, gridSize) } : point;
}

export function connectorPoints(element: DrawElement, elements: DrawElement[]): { start: Point; end: Point } {
  const startTarget = element.startBinding ? elements.find((candidate) => candidate.id === element.startBinding?.elementId) : null;
  const endTarget = element.endBinding ? elements.find((candidate) => candidate.id === element.endBinding?.elementId) : null;
  return {
    start: startTarget && element.startBinding ? getAnchorPoint(startTarget, element.startBinding.anchor) : { x: element.x, y: element.y },
    end: endTarget && element.endBinding ? getAnchorPoint(endTarget, element.endBinding.anchor) : { x: element.x + element.width, y: element.y + element.height },
  };
}

export function bezierPath(start: Point, end: Point) {
  const distance = Math.max(50, Math.abs(end.x - start.x) * 0.45);
  const direction = end.x >= start.x ? 1 : -1;
  return `M ${start.x} ${start.y} C ${start.x + distance * direction} ${start.y}, ${end.x - distance * direction} ${end.y}, ${end.x} ${end.y}`;
}

export function createId(prefix = "element") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
