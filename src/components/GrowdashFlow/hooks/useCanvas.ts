import { useCallback, useState } from "react";
import type { Point } from "../types";

export function useCanvas(initialZoom = 1, initialPan: Point = { x: 0, y: 0 }) {
  const [zoom, setZoomState] = useState(Math.min(5, Math.max(0.1, initialZoom)));
  const [panOffset, setPanOffset] = useState(initialPan);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);

  const setZoom = useCallback((next: number | ((zoom: number) => number)) => {
    setZoomState((current) => Math.min(5, Math.max(0.1, typeof next === "function" ? next(current) : next)));
  }, []);

  const zoomAt = useCallback((client: Point, rect: DOMRect, delta: number) => {
    setZoomState((current) => {
      const next = Math.min(5, Math.max(0.1, current * (delta > 0 ? 0.9 : 1.1)));
      const worldX = (client.x - rect.left - panOffset.x) / current;
      const worldY = (client.y - rect.top - panOffset.y) / current;
      setPanOffset({
        x: client.x - rect.left - worldX * next,
        y: client.y - rect.top - worldY * next,
      });
      return next;
    });
  }, [panOffset]);

  const clientToWorld = useCallback((client: Point, rect: DOMRect): Point => ({
    x: (client.x - rect.left - panOffset.x) / zoom,
    y: (client.y - rect.top - panOffset.y) / zoom,
  }), [panOffset, zoom]);

  const resetView = useCallback(() => {
    setZoomState(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  return { zoom, setZoom, zoomAt, panOffset, setPanOffset, clientToWorld, resetView, showGrid, setShowGrid, snapToGrid, setSnapToGrid };
}
