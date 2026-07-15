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
  return <div className="absolute left-1/2 top-2 z-30 flex max-w-[calc(100%-5.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-[#F5A623]/20 bg-[#16130f]/90 p-1.5 shadow-2xl backdrop-blur-xl sm:top-3">
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/5 hover:text-[#F5A623]" onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl/⌘ Z)"><Undo2 className="h-4 w-4" /></Button>
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/5 hover:text-[#F5A623]" onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl/⌘ Shift Z)"><Redo2 className="h-4 w-4" /></Button>
    <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/5 hover:text-[#F5A623]" onClick={() => onZoom(-0.15)}><ZoomOut className="h-4 w-4" /></Button>
    <button type="button" onClick={onResetView} className="min-w-14 shrink-0 rounded-lg px-2 py-1 text-[11px] font-black tabular-nums text-white/75 hover:bg-white/5" title="Restaurar visão em 100%">{Math.round(zoom * 100)}%</button>
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/5 hover:text-[#F5A623]" onClick={() => onZoom(0.15)}><ZoomIn className="h-4 w-4" /></Button>
    <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
    <Button variant="ghost" size="icon" className={cn("h-8 w-8 shrink-0 text-white/70 hover:bg-white/5 hover:text-[#F5A623]", showGrid && "bg-[#F5A623]/10 text-[#F5A623]")} onClick={onToggleGrid} title="Mostrar/esconder grade"><Grid3X3 className="h-4 w-4" /></Button>
    <button type="button" onClick={onToggleSnap} className={cn("h-8 shrink-0 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-white/55 hover:bg-white/5", snapToGrid && "bg-[#F5A623]/10 text-[#F5A623]")} title="Encaixar na grade">Snap</button>
    <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white/60 hover:bg-red-500/10 hover:text-red-400" title="Limpar quadro"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Limpar todo o quadro?</AlertDialogTitle><AlertDialogDescription>Todos os elementos serão removidos. Você ainda poderá usar Desfazer enquanto permanecer nesta tela.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onClear}>Limpar tudo</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5 text-white/70 hover:bg-white/5 hover:text-[#F5A623]"><Download className="h-4 w-4" /><span className="hidden sm:inline">Exportar</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => onExport("png")}>Exportar PNG</DropdownMenuItem><DropdownMenuItem onClick={() => onExport("svg")}>Exportar SVG</DropdownMenuItem><DropdownMenuItem onClick={() => onExport("json")}>Exportar JSON</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
    <Button size="sm" onClick={onSave} disabled={saving} className="h-8 shrink-0 gap-1.5 bg-[#F5A623] font-black text-[#1d1405] hover:bg-[#ffc14d]"><Save className="h-4 w-4" /><span className="hidden sm:inline">{saving ? "Salvando…" : "Salvar"}</span></Button>
  </div>;
}
