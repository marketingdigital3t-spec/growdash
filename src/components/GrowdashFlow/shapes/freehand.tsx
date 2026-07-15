import type { DrawElement } from "../types";

export function FreehandShape({ element }: { element: DrawElement }) {
  const points = (element.points || []).map((point) => `${element.x + point.x},${element.y + point.y}`).join(" ");
  return <polyline points={points} fill="none" stroke={element.strokeColor} strokeWidth={element.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
}
