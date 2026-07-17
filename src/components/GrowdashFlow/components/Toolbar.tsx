import {
  Circle,
  Diamond,
  Hand,
  ImagePlus,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Square,
  StickyNote,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolType } from "../types";

const TOOLS: Array<{ tool: ToolType; label: string; shortcut: string; icon: typeof MousePointer2 }> = [
  { tool: "select", label: "Selecionar", shortcut: "V", icon: MousePointer2 },
  { tool: "hand", label: "Mover canvas", shortcut: "H", icon: Hand },
  { tool: "rectangle", label: "Retângulo", shortcut: "R", icon: Square },
  { tool: "ellipse", label: "Elipse", shortcut: "O", icon: Circle },
  { tool: "diamond", label: "Losango", shortcut: "D", icon: Diamond },
  { tool: "line", label: "Linha", shortcut: "L", icon: Minus },
  { tool: "arrow", label: "Seta conectável", shortcut: "A", icon: MoveUpRight },
  { tool: "text", label: "Texto", shortcut: "T", icon: Type },
  { tool: "freehand", label: "Desenho livre", shortcut: "P", icon: Pencil },
  { tool: "image", label: "Imagem", shortcut: "I", icon: ImagePlus },
  { tool: "sticky", label: "Nota adesiva", shortcut: "N", icon: StickyNote },
];

export function Toolbar({ tool, onToolChange, onImage }: { tool: ToolType; onToolChange: (tool: ToolType) => void; onImage: () => void }) {
  return <div aria-label="Ferramentas de desenho" className="absolute left-1/2 top-16 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-[0_12px_35px_-18px_rgba(0,0,0,.35)] backdrop-blur-xl dark:border-[#F5A623]/20 dark:bg-[#090909]/94 2xl:top-3 2xl:max-w-[calc(100%-30rem)]">
    {TOOLS.map((item, index) => {
      const Icon = item.icon;
      const active = tool === item.tool;
      return <button
        key={item.tool}
        type="button"
        title={`${item.label} (${item.shortcut})`}
        aria-label={item.label}
        aria-pressed={active}
        onClick={() => item.tool === "image" ? onImage() : onToolChange(item.tool)}
        className={cn(
          "group relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-slate-600 transition hover:border-[#F5A623]/35 hover:bg-[#F5A623]/10 hover:text-[#9d6908] dark:text-white/65 dark:hover:text-[#F5A623]",
          active ? "border-[#F5A623]/55 bg-[#F5A623]/20 text-[#7b5104] shadow-[0_0_22px_-10px_#F5A623] dark:bg-[#F5A623] dark:text-[#1b1306]" : "border-transparent",
          index === 2 && "ml-1 border-l-[#F5A623]/20",
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="pointer-events-none absolute top-11 hidden whitespace-nowrap rounded-lg border border-black/10 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 shadow-xl group-hover:block dark:border-white/10 dark:bg-[#0e0e0e] dark:text-white">{item.label} · {item.shortcut}</span>
      </button>;
    })}
  </div>;
}
