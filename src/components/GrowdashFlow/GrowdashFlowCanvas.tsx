import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clipboard, Copy, MousePointer2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Canvas, type SelectionBox } from "./components/Canvas";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Toolbar } from "./components/Toolbar";
import { TopBar } from "./components/TopBar";
import { useCanvas } from "./hooks/useCanvas";
import { createDrawElement, useDrawing } from "./hooks/useDrawing";
import { useUndoRedo } from "./hooks/useUndoRedo";
import type { DrawElement, FlowData, Point, ResizeHandle, ToolType } from "./types";
import { EMPTY_FLOW } from "./types";
import { boundsFromPoints, boundsIntersect, createId, getElementBounds, nearestAnchor, normalizeBounds, pointInElement, snapPoint } from "./utils/geometry";
import { exportFlowJson, exportFlowPng, exportFlowSvg } from "./utils/export";

export type GrowdashFlowCanvasHandle = {
  save: () => Promise<void>;
  getFlowData: () => FlowData;
};

export type GrowdashFlowCanvasProps = {
  initialFlow?: FlowData;
  onSave: (flowData: FlowData) => void | Promise<void>;
  onBack?: () => void;
  title?: string;
  className?: string;
};

type Interaction =
  | { kind: "pan"; startClient: Point; startPan: Point }
  | { kind: "draw"; elementId: string; start: Point }
  | { kind: "drag"; start: Point; snapshot: DrawElement[]; ids: string[] }
  | { kind: "select"; start: Point }
  | { kind: "resize"; start: Point; snapshot: DrawElement[]; element: DrawElement; handle: ResizeHandle };

const CONNECTABLE_TYPES = new Set<DrawElement["type"]>(["rectangle", "ellipse", "diamond", "sticky", "text", "image"]);
const TOOL_SHORTCUTS: Partial<Record<string, ToolType>> = { v: "select", h: "hand", r: "rectangle", o: "ellipse", d: "diamond", l: "line", a: "arrow", t: "text", p: "freehand", n: "sticky" };

export const GrowdashFlowCanvas = forwardRef<GrowdashFlowCanvasHandle, GrowdashFlowCanvasProps>(function GrowdashFlowCanvas({ initialFlow, onSave, onBack, title = "Growdash Flow", className = "" }, ref) {
  const flow = initialFlow || EMPTY_FLOW;
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const textSnapshotRef = useRef<DrawElement[] | null>(null);
  const [tool, setTool] = useState<ToolType>("select");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox>(null);
  const [clipboard, setClipboard] = useState<DrawElement[] | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ client: Point; world: Point } | null>(null);
  const history = useUndoRedo<DrawElement[]>(structuredClone(flow.elements || []));
  const canvas = useCanvas(flow.zoom || 1, flow.panOffset || { x: 0, y: 0 });
  const { moveElements } = useDrawing();
  const { toast } = useToast();

  useEffect(() => {
    canvas.setShowGrid(flow.showGrid ?? true);
    canvas.setSnapToGrid(flow.snapToGrid ?? false);
  // Apenas na carga/troca explícita do quadro.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFlow]);

  const getFlowData = useCallback((): FlowData => ({
    version: 1,
    elements: history.valueRef.current,
    zoom: canvas.zoom,
    panOffset: canvas.panOffset,
    showGrid: canvas.showGrid,
    snapToGrid: canvas.snapToGrid,
    updatedAt: new Date().toISOString(),
  }), [canvas.panOffset, canvas.showGrid, canvas.snapToGrid, canvas.zoom, history.valueRef]);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(getFlowData());
      toast({ title: "Quadro salvo", description: "O Growdash Flow foi atualizado com segurança." });
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [getFlowData, onSave, toast]);

  useImperativeHandle(ref, () => ({ save, getFlowData }), [getFlowData, save]);

  const rootRect = useCallback(() => rootRef.current?.getBoundingClientRect() || new DOMRect(), []);
  const clientToWorld = useCallback((clientX: number, clientY: number) => canvas.clientToWorld({ x: clientX, y: clientY }, rootRect()), [canvas, rootRect]);
  const topLayer = useMemo(() => Math.max(0, ...history.value.map((element) => element.layerIndex)) + 1, [history.value]);
  const selectedElements = useMemo(() => history.value.filter((element) => selectedIds.includes(element.id)), [history.value, selectedIds]);
  const primarySelected = selectedElements[0] || null;

  const addImage = useCallback((file: File, client?: Point) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "Use uma imagem de até 2 MB para manter o quadro rápido e seguro.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const rect = rootRect();
      const point = client ? canvas.clientToWorld(client, rect) : canvas.clientToWorld({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, rect);
      const element: DrawElement = {
        id: createId("image"), type: "image", x: point.x - 160, y: point.y - 100, width: 320, height: 200,
        rotation: 0, opacity: 1, fillColor: "transparent", strokeColor: "#F5A623", strokeWidth: 2,
        imageUrl: String(reader.result), layerIndex: topLayer, locked: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      history.commit((elements) => [...elements, element]);
      setSelectedIds([element.id]);
      setTool("select");
    };
    reader.readAsDataURL(file);
  }, [canvas, history, rootRect, toast, topLayer]);

  const findTopElement = useCallback((point: Point, excludeId?: string) => [...history.valueRef.current]
    .sort((a, b) => b.layerIndex - a.layerIndex)
    .find((element) => element.id !== excludeId && CONNECTABLE_TYPES.has(element.type) && pointInElement(point, element, 12 / canvas.zoom)), [canvas.zoom, history.valueRef]);

  const startDrawing = useCallback((point: Point, source?: DrawElement) => {
    const element = createDrawElement(tool, point, topLayer, canvas.snapToGrid);
    if (!element) return;
    if ((tool === "line" || tool === "arrow") && source) element.startBinding = { elementId: source.id, anchor: nearestAnchor(source, point).anchor };
    history.commit((elements) => [...elements, element]);
    setSelectedIds([element.id]);
    interactionRef.current = { kind: "draw", elementId: element.id, start: point };
    if (tool === "text" || tool === "sticky") {
      setEditingId(element.id);
      textSnapshotRef.current = structuredClone(history.valueRef.current);
      interactionRef.current = null;
      setTool("select");
    }
  }, [canvas.snapToGrid, history, tool, topLayer]);

  const handleElementPointerDown = useCallback((event: React.PointerEvent<SVGGElement>, element: DrawElement) => {
    event.stopPropagation();
    if (editingId) return;
    const point = clientToWorld(event.clientX, event.clientY);
    if (tool === "arrow" || tool === "line") {
      startDrawing(point, element);
      return;
    }
    if (tool === "hand" || spacePressed || event.button === 1 || event.button === 2) {
      interactionRef.current = { kind: "pan", startClient: { x: event.clientX, y: event.clientY }, startPan: canvas.panOffset };
      return;
    }
    if (tool !== "select") return;
    const nextIds = event.shiftKey
      ? selectedIds.includes(element.id) ? selectedIds.filter((id) => id !== element.id) : [...selectedIds, element.id]
      : selectedIds.includes(element.id) ? selectedIds : [element.id];
    setSelectedIds(nextIds);
    if (!element.locked) interactionRef.current = { kind: "drag", start: point, snapshot: structuredClone(history.valueRef.current), ids: nextIds };
  }, [canvas.panOffset, clientToWorld, editingId, history.valueRef, selectedIds, spacePressed, startDrawing, tool]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setContextMenu(null);
    const point = clientToWorld(event.clientX, event.clientY);
    if (tool === "hand" || spacePressed || event.button === 1 || event.button === 2) {
      interactionRef.current = { kind: "pan", startClient: { x: event.clientX, y: event.clientY }, startPan: canvas.panOffset };
      return;
    }
    if (event.button !== 0) return;
    if (tool === "select") {
      if (!event.shiftKey) setSelectedIds([]);
      setSelectionBox({ start: point, end: point });
      interactionRef.current = { kind: "select", start: point };
      return;
    }
    startDrawing(point);
  }, [canvas.panOffset, clientToWorld, spacePressed, startDrawing, tool]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    if (interaction.kind === "pan") {
      canvas.setPanOffset({ x: interaction.startPan.x + event.clientX - interaction.startClient.x, y: interaction.startPan.y + event.clientY - interaction.startClient.y });
      return;
    }
    const rawPoint = clientToWorld(event.clientX, event.clientY);
    const point = snapPoint(rawPoint, canvas.snapToGrid);
    if (interaction.kind === "select") {
      setSelectionBox({ start: interaction.start, end: point });
      return;
    }
    if (interaction.kind === "drag") {
      history.replace(moveElements(interaction.snapshot, interaction.ids, { x: point.x - interaction.start.x, y: point.y - interaction.start.y }, canvas.snapToGrid));
      return;
    }
    if (interaction.kind === "resize") {
      const startBounds = getElementBounds(interaction.element);
      const dx = point.x - interaction.start.x;
      const dy = point.y - interaction.start.y;
      let left = startBounds.x, top = startBounds.y, right = startBounds.x + startBounds.width, bottom = startBounds.y + startBounds.height;
      if (interaction.handle.includes("w")) left += dx;
      if (interaction.handle.includes("e")) right += dx;
      if (interaction.handle.includes("n")) top += dy;
      if (interaction.handle.includes("s")) bottom += dy;
      if (interaction.handle === "n" || interaction.handle === "s") { left = startBounds.x; right = startBounds.x + startBounds.width; }
      if (interaction.handle === "e" || interaction.handle === "w") { top = startBounds.y; bottom = startBounds.y + startBounds.height; }
      const bounds = normalizeBounds(left, top, right - left, bottom - top);
      history.replace(interaction.snapshot.map((element) => element.id === interaction.element.id ? { ...element, x: bounds.x, y: bounds.y, width: Math.max(20, bounds.width), height: Math.max(20, bounds.height), updatedAt: new Date().toISOString() } : element));
      return;
    }
    history.replace((elements) => elements.map((element) => {
      if (element.id !== interaction.elementId) return element;
      if (element.type === "freehand") return { ...element, points: [...(element.points || []), { x: rawPoint.x - interaction.start.x, y: rawPoint.y - interaction.start.y }], width: rawPoint.x - interaction.start.x, height: rawPoint.y - interaction.start.y };
      if (element.type === "line" || element.type === "arrow") return { ...element, width: point.x - interaction.start.x, height: point.y - interaction.start.y };
      const bounds = boundsFromPoints(interaction.start, point);
      return { ...element, ...bounds };
    }));
  }, [canvas, clientToWorld, history, moveElements]);

  const finishInteraction = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction) return;
    if (interaction.kind === "draw") {
      const point = clientToWorld(event.clientX, event.clientY);
      history.replace((elements) => elements.map((element) => {
        if (element.id !== interaction.elementId || (element.type !== "arrow" && element.type !== "line")) return element;
        const target = findTopElement(point, element.id);
        return target ? { ...element, endBinding: { elementId: target.id, anchor: nearestAnchor(target, point).anchor } } : element;
      }));
      setTool("select");
    } else if (interaction.kind === "drag" || interaction.kind === "resize") {
      history.checkpoint(interaction.snapshot);
    } else if (interaction.kind === "select") {
      const box = boundsFromPoints(interaction.start, clientToWorld(event.clientX, event.clientY));
      const hits = history.valueRef.current.filter((element) => boundsIntersect(box, getElementBounds(element))).map((element) => element.id);
      setSelectedIds((current) => event.shiftKey ? Array.from(new Set([...current, ...hits])) : hits);
      setSelectionBox(null);
    }
    interactionRef.current = null;
  }, [clientToWorld, findTopElement, history]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<SVGRectElement>, handle: ResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();
    if (!primarySelected || primarySelected.locked) return;
    interactionRef.current = { kind: "resize", start: clientToWorld(event.clientX, event.clientY), snapshot: structuredClone(history.valueRef.current), element: structuredClone(primarySelected), handle };
  }, [clientToWorld, history.valueRef, primarySelected]);

  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    history.commit((elements) => elements.filter((element) => !selectedIds.includes(element.id)));
    setSelectedIds([]);
  }, [history, selectedIds]);

  const copySelected = useCallback(() => {
    if (!selectedElements.length) return;
    setClipboard(structuredClone(selectedElements));
  }, [selectedElements]);

  const paste = useCallback(() => {
    if (!clipboard?.length) return;
    const offset = 28;
    const maxLayer = Math.max(topLayer, ...history.valueRef.current.map((element) => element.layerIndex));
    const next = clipboard.map((element, index) => ({ ...structuredClone(element), id: createId(element.type), x: element.x + offset, y: element.y + offset, layerIndex: maxLayer + index + 1, startBinding: undefined, endBinding: undefined }));
    history.commit((elements) => [...elements, ...next]);
    setSelectedIds(next.map((element) => element.id));
    setClipboard(structuredClone(next));
  }, [clipboard, history, topLayer]);

  const duplicateSelected = useCallback(() => { copySelected(); const source = selectedElements; if (!source.length) return; const next = source.map((element, index) => ({ ...structuredClone(element), id: createId(element.type), x: element.x + 24, y: element.y + 24, layerIndex: topLayer + index, startBinding: undefined, endBinding: undefined })); history.commit((elements) => [...elements, ...next]); setSelectedIds(next.map((element) => element.id)); }, [copySelected, history, selectedElements, topLayer]);

  const changeSelected = useCallback((patch: Partial<DrawElement>) => {
    history.commit((elements) => elements.map((element) => selectedIds.includes(element.id) ? { ...element, ...patch, updatedAt: new Date().toISOString() } : element));
  }, [history, selectedIds]);

  const moveLayer = useCallback((direction: "front" | "back") => {
    const ordered = [...history.valueRef.current].sort((a, b) => a.layerIndex - b.layerIndex);
    const boundary = direction === "front" ? Math.max(...ordered.map((element) => element.layerIndex), 0) + 1 : Math.min(...ordered.map((element) => element.layerIndex), 0) - selectedIds.length;
    history.commit((elements) => elements.map((element, index) => selectedIds.includes(element.id) ? { ...element, layerIndex: boundary + index } : element));
  }, [history, selectedIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      if (event.code === "Space" && !isEditing) { event.preventDefault(); setSpacePressed(true); }
      if (isEditing) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === "z") { event.preventDefault(); event.shiftKey ? history.redo() : history.undo(); return; }
      if (mod && key === "y") { event.preventDefault(); history.redo(); return; }
      if (mod && key === "c") { event.preventDefault(); copySelected(); return; }
      if (mod && key === "v") { event.preventDefault(); paste(); return; }
      if (mod && key === "d") { event.preventDefault(); duplicateSelected(); return; }
      if (mod && key === "a") { event.preventDefault(); setSelectedIds(history.valueRef.current.map((element) => element.id)); return; }
      if (key === "delete" || key === "backspace") { event.preventDefault(); deleteSelected(); return; }
      if (key === "escape") { setSelectedIds([]); setEditingId(null); setTool("select"); return; }
      if (!mod && TOOL_SHORTCUTS[key]) setTool(TOOL_SHORTCUTS[key]!);
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === "Space") setSpacePressed(false); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [copySelected, deleteSelected, duplicateSelected, history, paste]);

  const handleExport = useCallback(async (type: "png" | "svg" | "json") => {
    const data = getFlowData();
    if (!data.elements.length) { toast({ title: "O quadro está vazio", description: "Adicione pelo menos um elemento antes de exportar." }); return; }
    if (type === "json") exportFlowJson(data);
    else if (type === "svg") exportFlowSvg(data);
    else await exportFlowPng(data);
  }, [getFlowData, toast]);

  const finishTextEditing = useCallback(() => {
    if (textSnapshotRef.current) history.checkpoint(textSnapshotRef.current);
    textSnapshotRef.current = null;
    setEditingId(null);
  }, [history]);

  return <section ref={rootRef} className={`relative min-h-[620px] h-[calc(100dvh-7.5rem)] w-full overflow-hidden rounded-2xl border border-[#F5A623]/20 bg-[#121212] shadow-[0_24px_80px_rgba(0,0,0,.38)] ${className}`}>
    <Canvas
      elements={history.value}
      selectedIds={selectedIds}
      zoom={canvas.zoom}
      panOffset={canvas.panOffset}
      showGrid={canvas.showGrid}
      editingId={editingId}
      selectionBox={selectionBox}
      cursor={interactionRef.current?.kind === "pan" ? "grabbing" : tool === "hand" || spacePressed ? "grab" : tool === "select" ? "default" : "crosshair"}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishInteraction}
      onWheel={(event) => { event.preventDefault(); canvas.zoomAt({ x: event.clientX, y: event.clientY }, rootRect(), event.deltaY); }}
      onElementPointerDown={handleElementPointerDown}
      onElementDoubleClick={(element) => { if (element.type === "text" || element.type === "sticky") { textSnapshotRef.current = structuredClone(history.valueRef.current); setEditingId(element.id); setSelectedIds([element.id]); } }}
      onResizePointerDown={handleResizePointerDown}
      onTextChange={(elementId, value) => history.replace((elements) => elements.map((element) => element.id === elementId ? { ...element, text: value, updatedAt: new Date().toISOString() } : element))}
      onFinishEditing={finishTextEditing}
      onDropFiles={(files, client) => Array.from(files).forEach((file) => addImage(file, client))}
      onContextMenu={(event) => { event.preventDefault(); setContextMenu({ client: { x: event.clientX - rootRect().left, y: event.clientY - rootRect().top }, world: clientToWorld(event.clientX, event.clientY) }); }}
    />

    <div className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[36%] items-center gap-2 sm:left-3 sm:top-3"><div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#16130f]/88 p-1.5 pr-3 backdrop-blur-xl">{onBack && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/60 hover:bg-white/5 hover:text-[#F5A623]" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>}<div className="hidden min-w-0 sm:block"><span className="block truncate text-[10px] font-black uppercase tracking-[.16em] text-[#F5A623]">Growdash Flow</span><strong className="block truncate text-xs text-white/85">{title}</strong></div></div></div>
    <Toolbar tool={tool} onToolChange={setTool} onImage={() => fileInputRef.current?.click()} />
    <TopBar zoom={canvas.zoom} canUndo={history.canUndo} canRedo={history.canRedo} showGrid={canvas.showGrid} snapToGrid={canvas.snapToGrid} saving={isSaving} onUndo={history.undo} onRedo={history.redo} onZoom={(delta) => canvas.setZoom((current) => current + delta)} onResetView={canvas.resetView} onToggleGrid={() => canvas.setShowGrid((value) => !value)} onToggleSnap={() => canvas.setSnapToGrid((value) => !value)} onClear={() => { history.commit([]); setSelectedIds([]); }} onSave={() => void save()} onExport={(type) => void handleExport(type)} />
    {primarySelected && <PropertiesPanel element={primarySelected} selectionCount={selectedIds.length} onChange={changeSelected} onDuplicate={duplicateSelected} onDelete={deleteSelected} onFront={() => moveLayer("front")} onBack={() => moveLayer("back")} onClose={() => setSelectedIds([])} />}

    {contextMenu && <div className="absolute z-50 min-w-44 rounded-xl border border-white/10 bg-[#17130e]/96 p-1.5 text-xs text-white shadow-2xl backdrop-blur-xl" style={{ left: Math.min(contextMenu.client.x, rootRect().width - 190), top: Math.min(contextMenu.client.y, rootRect().height - 190) }}>
      <ContextAction icon={Clipboard} label="Colar" shortcut="Ctrl V" disabled={!clipboard?.length} onClick={() => { paste(); setContextMenu(null); }} />
      <ContextAction icon={Copy} label="Duplicar" shortcut="Ctrl D" disabled={!selectedIds.length} onClick={() => { duplicateSelected(); setContextMenu(null); }} />
      <ContextAction icon={MousePointer2} label="Selecionar tudo" shortcut="Ctrl A" onClick={() => { setSelectedIds(history.valueRef.current.map((element) => element.id)); setContextMenu(null); }} />
      <ContextAction icon={Trash2} label="Excluir" shortcut="Delete" danger disabled={!selectedIds.length} onClick={() => { deleteSelected(); setContextMenu(null); }} />
    </div>}

    <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#16130f]/82 px-3 py-1.5 text-[9px] font-bold text-white/45 backdrop-blur-xl"><span>{history.value.length} elementos</span><span className="h-1 w-1 rounded-full bg-[#F5A623]" /><span>{selectedIds.length} selecionado(s)</span><span className="hidden sm:inline">Espaço + arrastar para mover</span></div>
    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" multiple onChange={(event) => { Array.from(event.target.files || []).forEach((file) => addImage(file)); event.target.value = ""; }} />
  </section>;
});

function ContextAction({ icon: Icon, label, shortcut, disabled, danger, onClick }: { icon: typeof Clipboard; label: string; shortcut: string; disabled?: boolean; danger?: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5 disabled:opacity-35 ${danger ? "text-red-400" : "text-white/75"}`}><Icon className="h-3.5 w-3.5" /><span className="grow">{label}</span><span className="text-[9px] text-white/30">{shortcut}</span></button>;
}

export default GrowdashFlowCanvas;
