import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { DrawElement, FlowData } from "./types";

type ExcalidrawScene = { elements: readonly OrderedExcalidrawElement[]; files: BinaryFiles };

const now = () => Date.now();
const id = (value: string, suffix = "shape") => `${value}__${suffix}`;

function makeElement(type: string, element: DrawElement, overrides: Record<string, unknown> = {}) {
  return {
    id: element.id, type, x: element.x, y: element.y, width: Math.max(1, element.width), height: Math.max(1, element.height), angle: element.rotation || 0,
    strokeColor: element.strokeColor || "#1f2937", backgroundColor: element.fillColor === "transparent" ? "transparent" : (element.fillColor || "transparent"),
    fillStyle: "solid", strokeWidth: element.strokeWidth || 1, strokeStyle: "solid", roughness: 1, opacity: Math.round((element.opacity ?? 1) * 100),
    roundness: null, seed: 1, version: 1, versionNonce: 1, index: null, isDeleted: false, groupIds: [], frameId: null, boundElements: null,
    updated: now(), link: null, locked: Boolean(element.locked), customData: { growdashId: element.id, growdashType: element.type, growdash: element }, ...overrides,
  } as unknown as OrderedExcalidrawElement;
}

function base(element: DrawElement) {
  return {};
}

function toElement(element: DrawElement): OrderedExcalidrawElement[] {
  const b = base(element);
  if (element.type === "text") {
    return [makeElement("text", element, { text: element.text || "", originalText: element.text || "", fontSize: element.fontSize || 18, fontFamily: 5, textAlign: "left", verticalAlign: "middle", containerId: null, autoResize: true, lineHeight: 1.25 })];
  }
  if (element.type === "freehand") {
    return [makeElement("freedraw", element, { points: (element.points || [{ x: 0, y: 0 }, { x: element.width, y: element.height }]).map((p) => ({ x: p.x, y: p.y })), pressures: [], lastCommittedPoint: null, simulatePressure: false })];
  }
  if (element.type === "line" || element.type === "arrow") {
    const points = (element.points || [{ x: 0, y: 0 }, { x: element.width, y: element.height }]).map((p) => [p.x, p.y] as [number, number]);
    return [makeElement(element.type === "arrow" ? "arrow" : "line", element, { points, startArrowhead: null, endArrowhead: element.type === "arrow" ? "arrow" : null, lastCommittedPoint: null, startBinding: null, endBinding: null, elbowed: false })];
  }
  const shapeType = element.type === "diamond" || element.type === "ellipse" ? element.type : "rectangle";
  const shape = makeElement(shapeType, element);
  const result = [shape];
  if (element.text) {
    result.push(makeElement("text", element, {
      id: id(element.id, "text"),
      x: element.x + 12,
      y: element.y + 12,
      width: Math.max(20, element.width - 24),
      text: element.text,
      originalText: element.text,
      fontSize: element.fontSize || 18,
      containerId: shape.id,
      customData: { growdashTextFor: element.id },
    }));
  }
  return result;
}

export function flowToExcalidraw(flow: FlowData): ExcalidrawScene {
  return { elements: flow.elements.flatMap(toElement), files: {} };
}

function restoreElement(element: OrderedExcalidrawElement): DrawElement | null {
  const data = (element as any).customData;
  if (data?.growdashTextFor) return null;
  const original = data?.growdash as DrawElement | undefined;
  const type = data?.growdashType || (element.type === "freedraw" ? "freehand" : element.type);
  if (original) {
    return {
      ...original,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.angle,
      opacity: (element.opacity ?? 100) / 100,
      fillColor: (element as any).backgroundColor || original.fillColor,
      strokeColor: element.strokeColor || original.strokeColor,
      strokeWidth: element.strokeWidth || original.strokeWidth,
      locked: Boolean(element.locked),
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    id: element.id,
    type,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.angle,
    opacity: (element.opacity ?? 100) / 100,
    fillColor: (element as any).backgroundColor || "transparent",
    strokeColor: element.strokeColor || "#1f2937",
    strokeWidth: element.strokeWidth || 1,
    text: (element as any).text,
    layerIndex: 0,
    locked: Boolean(element.locked),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as DrawElement;
}

export function excalidrawToFlow(scene: ExcalidrawScene, previous: FlowData): FlowData {
  const textByParent = new Map<string, string>();
  scene.elements.forEach((element) => {
    const parent = (element as any).customData?.growdashTextFor;
    if (parent) textByParent.set(parent, (element as any).text || "");
  });
  const elements = scene.elements
    .map(restoreElement)
    .filter((element): element is DrawElement => Boolean(element))
    .map((element, index) => ({ ...element, text: textByParent.get(element.id) ?? element.text, layerIndex: index }));
  return { ...previous, elements, updatedAt: new Date().toISOString() };
}

export function isCompatibleFlow(value: unknown): value is FlowData {
  const flow = value as FlowData | null;
  return Boolean(flow && flow.version === 1 && Array.isArray(flow.elements) && typeof flow.zoom === "number" && flow.panOffset);
}
