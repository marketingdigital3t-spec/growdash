import type { DrawElement } from "../types";

export function FreehandShape({ element }: { element: DrawElement }) {
  const points = element.points || [];
  if (points.length === 0) return null;
  if (points.length === 1) {
    return <circle cx={element.x + points[0].x} cy={element.y + points[0].y} r={element.strokeWidth / 2} fill={element.strokeColor} />;
  }

  // Generate smooth cubic/quadratic bezier string path through points for Apple Freeform style
  let d = `M ${element.x + points[0].x} ${element.y + points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (element.x + points[i].x + element.x + points[i + 1].x) / 2;
    const yc = (element.y + points[i].y + element.y + points[i + 1].y) / 2;
    d += ` Q ${element.x + points[i].x} ${element.y + points[i].y}, ${xc} ${yc}`;
  }
  // Add ending point
  d += ` L ${element.x + points[points.length - 1].x} ${element.y + points[points.length - 1].y}`;

  return <path d={d} fill="none" stroke={element.strokeColor} strokeWidth={element.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
}
