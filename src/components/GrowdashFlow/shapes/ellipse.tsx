import type { DrawElement } from "../types";

export function EllipseShape({ element }: { element: DrawElement }) {
  return <ellipse cx={element.x + element.width / 2} cy={element.y + element.height / 2} rx={Math.abs(element.width / 2)} ry={Math.abs(element.height / 2)} fill={element.fillColor} stroke={element.strokeColor} strokeWidth={element.strokeWidth} />;
}
