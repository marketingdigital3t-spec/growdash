export type ToolType =
  | "select"
  | "hand"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "freehand"
  | "image"
  | "sticky";

export type Point = { x: number; y: number };
export type AnchorName = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export type ElementBinding = {
  elementId: string;
  anchor: AnchorName;
};

export interface DrawElement {
  id: string;
  type: Exclude<ToolType, "select" | "hand" | "image"> | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  points?: Point[];
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  imageUrl?: string;
  layerIndex: number;
  locked: boolean;
  startBinding?: ElementBinding;
  endBinding?: ElementBinding;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlowData {
  version: 1;
  elements: DrawElement[];
  zoom: number;
  panOffset: Point;
  showGrid: boolean;
  snapToGrid: boolean;
  updatedAt: string;
}

export interface DrawingState {
  elements: DrawElement[];
  selectedIds: string[];
  tool: ToolType;
  zoom: number;
  panOffset: Point;
  showGrid: boolean;
  snapToGrid: boolean;
  clipboard: DrawElement[] | null;
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const EMPTY_FLOW: FlowData = {
  version: 1,
  elements: [],
  zoom: 1,
  panOffset: { x: 0, y: 0 },
  showGrid: true,
  snapToGrid: false,
  updatedAt: new Date(0).toISOString(),
};
