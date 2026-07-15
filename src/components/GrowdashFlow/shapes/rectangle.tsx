import type { DrawElement } from "../types";

export function RectangleShape({ element }: { element: DrawElement }) {
  return <rect x={element.x} y={element.y} width={element.width} height={element.height} rx={12} fill={element.fillColor} stroke={element.strokeColor} strokeWidth={element.strokeWidth} />;
}
