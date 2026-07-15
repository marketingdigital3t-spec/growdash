import type { DrawElement, FlowData } from "../types";
import { bezierPath, connectorPoints, getElementBounds, getSelectionBounds } from "./geometry";

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] || character);
}

function elementSvg(element: DrawElement, elements: DrawElement[]) {
  const style = `opacity="${element.opacity}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth}"`;
  if (element.type === "rectangle") return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="12" fill="${element.fillColor}" ${style}/>`;
  if (element.type === "ellipse") return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${Math.abs(element.width / 2)}" ry="${Math.abs(element.height / 2)}" fill="${element.fillColor}" ${style}/>`;
  if (element.type === "diamond") return `<polygon points="${element.x + element.width / 2},${element.y} ${element.x + element.width},${element.y + element.height / 2} ${element.x + element.width / 2},${element.y + element.height} ${element.x},${element.y + element.height / 2}" fill="${element.fillColor}" ${style}/>`;
  if (element.type === "line" || element.type === "arrow") {
    const { start, end } = connectorPoints(element, elements);
    const path = element.startBinding || element.endBinding ? bezierPath(start, end) : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    return `<path d="${path}" fill="none" ${style} ${element.type === "arrow" ? 'marker-end="url(#arrow)"' : ""}/>`;
  }
  if (element.type === "freehand") return `<polyline points="${(element.points || []).map((point) => `${element.x + point.x},${element.y + point.y}`).join(" ")}" fill="none" ${style}/>`;
  if (element.type === "image") return `<image href="${element.imageUrl || ""}" x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"/>`;
  const textColor = element.type === "sticky" ? "#2b2111" : element.strokeColor;
  return `${element.type === "sticky" ? `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="${element.fillColor}" ${style}/>` : ""}<text x="${element.x + 12}" y="${element.y + (element.fontSize || 20) + 10}" fill="${textColor}" font-size="${element.fontSize || 20}" font-family="sans-serif">${escapeXml(element.text || "")}</text>`;
}

export function flowToSvg(flow: FlowData) {
  const bounds = getSelectionBounds(flow.elements, flow.elements.map((element) => element.id)) || { x: 0, y: 0, width: 1200, height: 720 };
  const padding = 60;
  const ordered = [...flow.elements].sort((a, b) => a.layerIndex - b.layerIndex);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.max(1, bounds.width + padding * 2)}" height="${Math.max(1, bounds.height + padding * 2)}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${Math.max(1, bounds.width + padding * 2)} ${Math.max(1, bounds.height + padding * 2)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#F5A623"/></marker></defs><rect x="${bounds.x - padding}" y="${bounds.y - padding}" width="${bounds.width + padding * 2}" height="${bounds.height + padding * 2}" fill="#121212"/>${ordered.map((element) => `<g transform="rotate(${element.rotation} ${getElementBounds(element).x + getElementBounds(element).width / 2} ${getElementBounds(element).y + getElementBounds(element).height / 2})">${elementSvg(element, flow.elements)}</g>`).join("")}</svg>`;
}

export function downloadBlob(content: BlobPart, mime: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFlowJson(flow: FlowData, filename = "growdash-flow.json") {
  downloadBlob(JSON.stringify(flow, null, 2), "application/json;charset=utf-8", filename);
}

export function exportFlowSvg(flow: FlowData, filename = "growdash-flow.svg") {
  downloadBlob(flowToSvg(flow), "image/svg+xml;charset=utf-8", filename);
}

export async function exportFlowPng(flow: FlowData, filename = "growdash-flow.png") {
  const svg = flowToSvg(flow);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const maxSize = 4096;
    const scale = Math.min(2, maxSize / Math.max(image.naturalWidth, image.naturalHeight, 1));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Falha ao exportar PNG");
    downloadBlob(blob, "image/png", filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
