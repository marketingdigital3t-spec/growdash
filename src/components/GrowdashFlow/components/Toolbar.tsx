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
  return <div className="absolute left-2 top-1/2 z-30 flex max-h-[calc(100%-1rem)] -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-2xl border border-[#F5A623]/20 bg-[#16130f]/90 p-1.5 shadow-2xl backdrop-blur-xl sm:left-3">
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
          "group relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-white/65 transition hover:border-[#F5A623]/30 hover:bg-[#F5A623]/10 hover:text-[#F5A623]",
          active ? "border-[#F5A623]/60 bg-[#F5A623] text-[#1b1306] shadow-[0_0_22px_-8px_#F5A623]" : "border-transparent",
          index === 2 && "mt-1 border-t-[#F5A623]/20",
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="pointer-events-none absolute left-12 hidden whitespace-nowrap rounded-lg border border-white/10 bg-[#0e0e0e] px-2 py-1 text-[10px] font-bold text-white shadow-xl group-hover:block">{item.label} · {item.shortcut}</span>
      </button>;
    })}
  </div>;
}
