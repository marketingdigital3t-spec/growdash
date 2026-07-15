import { memo, useMemo } from "react";
import type { DrawElement, Point, ResizeHandle } from "../types";
import { ShapeRenderer } from "../shapes";
import { getElementBounds, getSelectionBounds } from "../utils/geometry";

export type SelectionBox = { start: Point; end: Point } | null;

export const Canvas = memo(function Canvas({
  elements,
  selectedIds,
  zoom,
  panOffset,
  showGrid,
  editingId,
  selectionBox,
  cursor,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onWheel,
  onElementPointerDown,
  onElementDoubleClick,
  onResizePointerDown,
  onTextChange,
  onFinishEditing,
  onDropFiles,
  onContextMenu,
}: {
  elements: DrawElement[];
  selectedIds: string[];
  zoom: number;
  panOffset: Point;
  showGrid: boolean;
  editingId: string | null;
  selectionBox: SelectionBox;
  cursor: string;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  onElementPointerDown: (event: React.PointerEvent<SVGGElement>, element: DrawElement) => void;
  onElementDoubleClick: (element: DrawElement) => void;
  onResizePointerDown: (event: React.PointerEvent<SVGRectElement>, handle: ResizeHandle) => void;
  onTextChange: (elementId: string, value: string) => void;
  onFinishEditing: () => void;
  onDropFiles: (files: FileList, client: Point) => void;
  onContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const ordered = useMemo(() => [...elements].sort((a, b) => a.layerIndex - b.layerIndex), [elements]);
  const selectedBounds = getSelectionBounds(elements, selectedIds);
  const selection = selectionBox ? {
    x: Math.min(selectionBox.start.x, selectionBox.end.x),
    y: Math.min(selectionBox.start.y, selectionBox.end.y),
    width: Math.abs(selectionBox.end.x - selectionBox.start.x),
    height: Math.abs(selectionBox.end.y - selectionBox.start.y),
  } : null;

  return <div
    data-growdash-flow-canvas
    className="absolute inset-0 touch-none overflow-hidden bg-[#121212]"
    style={{ cursor }}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
    onWheel={onWheel}
    onContextMenu={onContextMenu}
    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
    onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) onDropFiles(event.dataTransfer.files, { x: event.clientX, y: event.clientY }); }}
  >
    {showGrid && <div className="pointer-events-none absolute inset-0 opacity-45" style={{ backgroundImage: "radial-gradient(circle, rgba(245,166,35,.35) 1px, transparent 1.2px)", backgroundSize: `${20 * zoom}px ${20 * zoom}px`, backgroundPosition: `${panOffset.x}px ${panOffset.y}px` }} />}
    <svg className="absolute inset-0 h-full w-full overflow-visible" aria-label="Canvas do Growdash Flow">
      <defs>
        <marker id="growdash-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#F5A623" /></marker>
        <filter id="growdash-flow-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity=".25" /></filter>
      </defs>
      <g transform={`translate(${panOffset.x} ${panOffset.y}) scale(${zoom})`}>
        {ordered.map((element) => {
          const bounds = getElementBounds(element);
          const selected = selectedIds.includes(element.id);
          return <g
            key={element.id}
            data-flow-element={element.id}
            opacity={element.opacity}
            transform={`rotate(${element.rotation} ${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})`}
            onPointerDown={(event) => onElementPointerDown(event, element)}
            onDoubleClick={(event) => { event.stopPropagation(); onElementDoubleClick(element); }}
          >
            <rect x={bounds.x - 8} y={bounds.y - 8} width={Math.max(16, bounds.width + 16)} height={Math.max(16, bounds.height + 16)} fill="transparent" stroke="transparent" />
            <ShapeRenderer element={element} elements={elements} editing={editingId === element.id} onTextChange={(value) => onTextChange(element.id, value)} onFinishEditing={onFinishEditing} />
            {selected && selectedIds.length === 1 && <rect x={bounds.x - 4 / zoom} y={bounds.y - 4 / zoom} width={bounds.width + 8 / zoom} height={bounds.height + 8 / zoom} fill="none" stroke="#F5A623" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} pointerEvents="none" />}
          </g>;
        })}

        {selectedBounds && <>
          {selectedIds.length > 1 && <rect x={selectedBounds.x - 5 / zoom} y={selectedBounds.y - 5 / zoom} width={selectedBounds.width + 10 / zoom} height={selectedBounds.height + 10 / zoom} fill="rgba(245,166,35,.04)" stroke="#F5A623" strokeWidth={1.5 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} pointerEvents="none" />}
          {selectedIds.length === 1 && ([
            ["nw", selectedBounds.x, selectedBounds.y], ["n", selectedBounds.x + selectedBounds.width / 2, selectedBounds.y], ["ne", selectedBounds.x + selectedBounds.width, selectedBounds.y],
            ["e", selectedBounds.x + selectedBounds.width, selectedBounds.y + selectedBounds.height / 2], ["se", selectedBounds.x + selectedBounds.width, selectedBounds.y + selectedBounds.height],
            ["s", selectedBounds.x + selectedBounds.width / 2, selectedBounds.y + selectedBounds.height], ["sw", selectedBounds.x, selectedBounds.y + selectedBounds.height], ["w", selectedBounds.x, selectedBounds.y + selectedBounds.height / 2],
          ] as Array<[ResizeHandle, number, number]>).map(([handle, x, y]) => <rect key={handle} x={x - 5 / zoom} y={y - 5 / zoom} width={10 / zoom} height={10 / zoom} rx={2 / zoom} fill="#121212" stroke="#F5A623" strokeWidth={2 / zoom} data-resize-handle={handle} onPointerDown={(event) => onResizePointerDown(event, handle)} style={{ cursor: `${handle}-resize` }} />)}
        </>}

        {selection && <rect x={selection.x} y={selection.y} width={selection.width} height={selection.height} fill="rgba(245,166,35,.10)" stroke="#F5A623" strokeWidth={1 / zoom} strokeDasharray={`${5 / zoom} ${4 / zoom}`} pointerEvents="none" />}
      </g>
    </svg>
  </div>;
});
