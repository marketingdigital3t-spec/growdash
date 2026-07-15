import type { DrawElement } from "../types";
import { RectangleShape } from "./rectangle";
import { EllipseShape } from "./ellipse";
import { DiamondShape } from "./diamond";
import { FreehandShape } from "./freehand";
import { LineShape } from "./line";

export function ShapeRenderer({ element, elements, editing, onTextChange, onFinishEditing }: {
  element: DrawElement;
  elements: DrawElement[];
  editing: boolean;
  onTextChange: (value: string) => void;
  onFinishEditing: () => void;
}) {
  if (element.type === "rectangle") return <RectangleShape element={element} />;
  if (element.type === "ellipse") return <EllipseShape element={element} />;
  if (element.type === "diamond") return <DiamondShape element={element} />;
  if (element.type === "line") return <LineShape element={element} elements={elements} />;
  if (element.type === "arrow") return <LineShape element={element} elements={elements} arrow />;
  if (element.type === "freehand") return <FreehandShape element={element} />;
  if (element.type === "image") {
    return <image href={element.imageUrl} x={element.x} y={element.y} width={element.width} height={element.height} preserveAspectRatio="xMidYMid slice" />;
  }
  if (element.type === "text" || element.type === "sticky") {
    return <>
      {element.type === "sticky" && <rect x={element.x} y={element.y} width={element.width} height={element.height} rx={8} fill={element.fillColor} stroke={element.strokeColor} strokeWidth={element.strokeWidth} filter="url(#growdash-flow-shadow)" />}
      {editing ? (
        <foreignObject x={element.x + 8} y={element.y + 8} width={Math.max(40, element.width - 16)} height={Math.max(36, element.height - 16)}>
          <textarea
            autoFocus
            value={element.text || ""}
            onChange={(event) => onTextChange(event.target.value)}
            onBlur={onFinishEditing}
            onKeyDown={(event) => { if (event.key === "Escape") onFinishEditing(); }}
            style={{ color: element.type === "sticky" ? "#2b2111" : element.strokeColor, fontSize: element.fontSize, fontFamily: element.fontFamily }}
            className="h-full w-full resize-none border-0 bg-transparent p-1 font-semibold leading-tight outline-none"
          />
        </foreignObject>
      ) : (
        <foreignObject x={element.x + 8} y={element.y + 8} width={Math.max(40, element.width - 16)} height={Math.max(36, element.height - 16)} pointerEvents="none">
          <div style={{ color: element.type === "sticky" ? "#2b2111" : element.strokeColor, fontSize: element.fontSize, fontFamily: element.fontFamily, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} className="h-full overflow-hidden p-1 font-semibold leading-tight">{element.text}</div>
        </foreignObject>
      )}
    </>;
  }
  return null;
}
