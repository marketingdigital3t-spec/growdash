import { Download, Grid3X3, Redo2, RotateCcw, Save, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function TopBar({
  zoom,
  canUndo,
  canRedo,
  showGrid,
  snapToGrid,
  saving,
  onUndo,
  onRedo,
  onZoom,
  onResetView,
  onToggleGrid,
  onToggleSnap,
  onClear,
  onSave,
  onExport,
}: {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  saving?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (delta: number) => void;
  onResetView: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onClear: () => void;
  onSave: () => void;
  onExport: (type: "png" | "svg" | "json") => void;
}) {
  const controlClass = "growdash-flow-control h-9 w-9 shrink-0";
  return <>
    <div aria-label="Ações do quadro" className="growdash-flow-chrome absolute right-3 top-3 z-30 flex items-center gap-1 rounded-2xl p-1.5">
      <Button variant="ghost" size="icon" className={cn(controlClass, showGrid && "growdash-flow-control-active")} onClick={onToggleGrid} title="Mostrar ou esconder grade"><Grid3X3 className="h-4 w-4" /></Button>
      <button type="button" onClick={onToggleSnap} className={cn("growdash-flow-control h-9 shrink-0 rounded-xl px-2 text-[10px] font-black uppercase tracking-wide", snapToGrid && "growdash-flow-control-active")} title="Encaixar na grade">Snap</button>
      <AlertDialog>
        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="growdash-flow-danger-control h-9 w-9 shrink-0" title="Limpar quadro"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Limpar todo o quadro?</AlertDialogTitle><AlertDialogDescription>Todos os elementos serão removidos. Você ainda poderá usar Desfazer enquanto permanecer nesta tela.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onClear}>Limpar tudo</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="growdash-flow-control h-9 shrink-0 gap-1.5"><Download className="h-4 w-4" /><span className="hidden 2xl:inline">Exportar</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onExport("png")}>Exportar PNG</DropdownMenuItem><DropdownMenuItem onClick={() => onExport("svg")}>Exportar SVG</DropdownMenuItem><DropdownMenuItem onClick={() => onExport("json")}>Exportar JSON</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" onClick={onSave} disabled={saving} className="h-9 shrink-0 gap-1.5 bg-primary font-black text-primary-foreground hover:bg-primary/90"><Save className="h-4 w-4" /><span className="hidden 2xl:inline">{saving ? "Salvando…" : "Salvar"}</span></Button>
    </div>

    <div aria-label="Zoom e histórico" className="growdash-flow-chrome absolute bottom-3 left-3 z-30 flex items-center gap-1 rounded-2xl p-1.5">
      <Button variant="ghost" size="icon" className={controlClass} onClick={() => onZoom(-0.15)} title="Diminuir zoom"><ZoomOut className="h-4 w-4" /></Button>
      <button type="button" onClick={onResetView} className="growdash-flow-control min-w-14 shrink-0 rounded-lg px-2 py-1 text-[11px] font-black tabular-nums" title="Restaurar visão em 100%">{Math.round(zoom * 100)}%</button>
      <Button variant="ghost" size="icon" className={controlClass} onClick={() => onZoom(0.15)} title="Aumentar zoom"><ZoomIn className="h-4 w-4" /></Button>
      <span className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />
      <Button variant="ghost" size="icon" className={controlClass} onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl/⌘ Z)"><Undo2 className="h-4 w-4" /></Button>
      <Button variant="ghost" size="icon" className={controlClass} onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl/⌘ Shift Z)"><Redo2 className="h-4 w-4" /></Button>
    </div>
  </>;
}
