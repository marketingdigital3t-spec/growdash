import type { DrawElement } from "../types";
import { bezierPath, connectorPoints } from "../utils/geometry";

export function LineShape({ element, elements, arrow = false }: { element: DrawElement; elements: DrawElement[]; arrow?: boolean }) {
  const { start, end } = connectorPoints(element, elements);
  const bound = Boolean(element.startBinding || element.endBinding);
  return <path d={bound ? bezierPath(start, end) : `M ${start.x} ${start.y} L ${end.x} ${end.y}`} fill="none" stroke={element.strokeColor} strokeWidth={element.strokeWidth} strokeLinecap="round" markerEnd={arrow ? "url(#growdash-flow-arrow)" : undefined} />;
}
