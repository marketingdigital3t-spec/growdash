import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob, getNonDeletedElements } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { ArrowLeft, Check, Download, AlertCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import type { FlowData } from "./types";
import { excalidrawToFlow, flowToExcalidraw } from "./excalidrawAdapter";
import "@excalidraw/excalidraw/index.css";

type Props = {
  initialFlow: FlowData;
  title: string;
  onBack: () => void;
  onSave: (flow: FlowData) => Promise<void>;
};

export function ExcalidrawFlowEditor({ initialFlow, title, onBack, onSave }: Props) {
  const { resolvedTheme } = useTheme();
  const excalidrawTheme = resolvedTheme === "dark" ? "dark" : "light";
  const initialScene = useRef(flowToExcalidraw(initialFlow));
  const latestScene = useRef(initialScene.current);
  const latestFlow = useRef(initialFlow);
  const saveTimer = useRef<number | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");

  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const scheduleSave = useCallback((flow: FlowData) => {
    latestFlow.current = flow;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = window.setTimeout(() => {
      void onSave(flow).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 700);
  }, [onSave]);

  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    latestScene.current = { elements, files };
    const next = excalidrawToFlow({ elements, files }, {
      ...latestFlow.current,
      zoom: appState.zoom.value,
      panOffset: { x: appState.scrollX, y: appState.scrollY },
      showGrid: appState.gridSize !== null,
    });
    scheduleSave(next);
  }, [scheduleSave]);

  const exportBoard = useCallback(async () => {
    const scene = latestScene.current;
    const blob = await exportToBlob({ elements: getNonDeletedElements(scene.elements), appState: { viewBackgroundColor: "#ffffff" } as AppState, files: scene.files, mimeType: "image/png", exportPadding: 24 });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `growdash-flow-${new Date().toISOString().slice(0, 10)}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <section className="flex min-h-[calc(100dvh-8.5rem)] min-w-0 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar para os funis"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Growdash Flow</p><h1 className="truncate text-xl font-black">{title}</h1></div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`hidden items-center gap-1.5 text-xs sm:flex ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`} role="status" aria-live="polite">
            {saveState === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : saveState === "saved" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : null}
            {saveState === "error" ? "Erro ao salvar" : saveState === "saving" ? "Salvando…" : "Salvo"}
          </span>
          <Button variant="outline" size="sm" onClick={() => void exportBoard()}><Download className="mr-2 h-4 w-4" />Exportar PNG</Button>
        </div>
      </header>
      <div className="relative min-h-[540px] min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm dark:bg-[#121212]">
        <Excalidraw
          initialData={{
            ...(initialScene.current as ExcalidrawInitialDataState),
            appState: {
              ...(initialScene.current as ExcalidrawInitialDataState).appState,
              theme: excalidrawTheme,
              viewBackgroundColor: excalidrawTheme === "dark" ? "#18181b" : "#ffffff",
            },
          }}
          theme={excalidrawTheme}
          onChange={handleChange}
          langCode="pt-BR"
        />
      </div>
    </section>
  );
}
