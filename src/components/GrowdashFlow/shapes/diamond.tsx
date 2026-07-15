import type { DrawElement } from "../types";

export function DiamondShape({ element }: { element: DrawElement }) {
  const points = `${element.x + element.width / 2},${element.y} ${element.x + element.width},${element.y + element.height / 2} ${element.x + element.width / 2},${element.y + element.height} ${element.x},${element.y + element.height / 2}`;
  return <polygon points={points} fill={element.fillColor} stroke={element.strokeColor} strokeWidth={element.strokeWidth} strokeLinejoin="round" />;
}
