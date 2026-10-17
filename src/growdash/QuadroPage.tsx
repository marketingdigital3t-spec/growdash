import { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  exportToBlob,
  getNonDeletedElements,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Download, Check, AlertCircle } from "lucide-react";
import "@excalidraw/excalidraw/index.css";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "growdash.quadro.v1";

type PersistedAppState = Pick<AppState, "viewBackgroundColor" | "scrollX" | "scrollY" | "zoom" | "theme">;

type StoredBoard = {
  version: 1;
  elements: readonly OrderedExcalidrawElement[];
  appState: PersistedAppState;
  files: BinaryFiles;
  updatedAt: string;
};

type SceneState = Omit<StoredBoard, "version" | "updatedAt">;

const defaultAppState: PersistedAppState = {
  viewBackgroundColor: "#ffffff",
  scrollX: 0,
  scrollY: 0,
  zoom: { value: 1 },
  theme: "light",
};

function readStoredBoard(): SceneState {
  if (typeof window === "undefined") return { elements: [], appState: defaultAppState, files: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { elements: [], appState: defaultAppState, files: {} };
    const parsed = JSON.parse(raw) as Partial<StoredBoard>;
    if (!Array.isArray(parsed.elements)) return { elements: [], appState: defaultAppState, files: {} };
    return {
      elements: parsed.elements,
      appState: { ...defaultAppState, ...(parsed.appState ?? {}) },
      files: parsed.files ?? {},
    };
  } catch {
    return { elements: [], appState: defaultAppState, files: {} };
  }
}

function pickPersistedAppState(appState: AppState): PersistedAppState {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
    theme: appState.theme,
  };
}

export default function QuadroPage() {
  const [scene, setScene] = useState<SceneState>(readStoredBoard);
  const [persistenceState, setPersistenceState] = useState<"idle" | "saved" | "error">("idle");
  const latestScene = useRef(scene);

  useEffect(() => {
    latestScene.current = scene;
    setPersistenceState("idle");
    const timer = window.setTimeout(() => {
      try {
        const payload: StoredBoard = {
          version: 1,
          ...scene,
          updatedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setPersistenceState("saved");
      } catch {
        setPersistenceState("error");
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [scene]);

  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    setScene({ elements, appState: pickPersistedAppState(appState), files });
  }, []);

  const exportBoard = useCallback(async () => {
    const current = latestScene.current;
    const blob = await exportToBlob({
      elements: getNonDeletedElements(current.elements),
      appState: current.appState,
      files: current.files,
      mimeType: "image/png",
      exportPadding: 24,
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `growdash-quadro-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <section className="flex min-h-[calc(100dvh-8.5rem)] min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/75 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">Inteligência visual</p>
          <h1 className="truncate text-xl font-black tracking-tight text-foreground">Quadro</h1>
          <p className="mt-1 text-xs text-muted-foreground">Organize ideias, fluxos e planos da sua operação em um único espaço.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("hidden items-center gap-1.5 text-[11px] font-semibold sm:flex", persistenceState === "error" ? "text-destructive" : "text-muted-foreground")} role="status" aria-live="polite">
            {persistenceState === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : persistenceState === "saved" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : null}
            {persistenceState === "error" ? "Não foi possível salvar localmente" : persistenceState === "saved" ? "Salvo neste dispositivo" : "Salvando automaticamente…"}
          </span>
          <button type="button" onClick={() => void exportBoard()} className="gd-button inline-flex items-center gap-2" aria-label="Exportar quadro como PNG">
            <Download className="h-4 w-4" />
            <span>Exportar PNG</span>
          </button>
        </div>
      </div>
      <div className="relative min-h-[540px] min-w-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_20px_70px_-35px_rgba(15,23,42,.45)] dark:bg-[#121212]">
        <div className="h-full min-h-[540px] w-full">
          <Excalidraw initialData={scene as ExcalidrawInitialDataState} onChange={handleChange} />
        </div>
      </div>
    </section>
  );
}
