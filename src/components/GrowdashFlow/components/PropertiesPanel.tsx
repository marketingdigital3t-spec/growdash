import { ArrowDownToLine, ArrowUpToLine, Copy, Lock, Trash2, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { DrawElement } from "../types";

export function PropertiesPanel({ element, selectionCount, onChange, onDuplicate, onDelete, onFront, onBack, onClose }: {
  element: DrawElement;
  selectionCount: number;
  onChange: (patch: Partial<DrawElement>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFront: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const numberChange = (key: keyof DrawElement) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: Number(event.target.value) || 0 });
  return <aside className="absolute bottom-2 right-2 top-14 z-30 w-[min(280px,calc(100%-5.5rem))] overflow-y-auto rounded-2xl border border-[#F5A623]/20 bg-[#16130f]/94 p-4 text-white shadow-2xl backdrop-blur-xl sm:bottom-3 sm:right-3 sm:top-16">
    <header className="mb-4 flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.18em] text-[#F5A623]">Propriedades</span><h3 className="mt-1 truncate text-sm font-black">{selectionCount > 1 ? `${selectionCount} elementos` : element.type}</h3></div><Button variant="ghost" size="icon" className="h-7 w-7 text-white/55 hover:bg-white/5 hover:text-white" onClick={onClose}><X className="h-4 w-4" /></Button></header>
    <div className="grid grid-cols-2 gap-2">
      {(["x", "y", "width", "height"] as const).map((key) => <div key={key} className="space-y-1"><Label className="text-[9px] uppercase text-white/45">{{ x: "X", y: "Y", width: "Largura", height: "Altura" }[key]}</Label><Input type="number" value={Math.round(element[key])} onChange={numberChange(key)} className="h-8 border-white/10 bg-black/25 text-xs text-white" disabled={selectionCount > 1} /></div>)}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-[9px] uppercase text-white/45">Preenchimento</Label><input type="color" value={element.fillColor === "transparent" ? "#121212" : element.fillColor} onChange={(event) => onChange({ fillColor: event.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/25 p-1" /></div><div className="space-y-1"><Label className="text-[9px] uppercase text-white/45">Borda</Label><input type="color" value={element.strokeColor} onChange={(event) => onChange({ strokeColor: event.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-black/25 p-1" /></div></div>
    <PropertySlider label={`Espessura · ${element.strokeWidth}px`} value={element.strokeWidth} min={1} max={10} onChange={(value) => onChange({ strokeWidth: value })} />
    <PropertySlider label={`Opacidade · ${Math.round(element.opacity * 100)}%`} value={element.opacity * 100} min={0} max={100} onChange={(value) => onChange({ opacity: value / 100 })} />
    <PropertySlider label={`Rotação · ${Math.round(element.rotation)}°`} value={element.rotation} min={0} max={360} onChange={(value) => onChange({ rotation: value })} />
    {(element.type === "text" || element.type === "sticky") && <PropertySlider label={`Texto · ${element.fontSize || 20}px`} value={element.fontSize || 20} min={10} max={72} onChange={(value) => onChange({ fontSize: value })} />}
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={onFront}><ArrowUpToLine className="mr-1.5 h-3.5 w-3.5" />Frente</Button><Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={onBack}><ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />Fundo</Button></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={onDuplicate}><Copy className="mr-1.5 h-3.5 w-3.5" />Duplicar</Button><Button variant="outline" size="sm" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => onChange({ locked: !element.locked })}>{element.locked ? <Unlock className="mr-1.5 h-3.5 w-3.5" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}{element.locked ? "Destravar" : "Travar"}</Button></div>
    <Button variant="outline" size="sm" className="mt-2 w-full border-red-500/25 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={onDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>
  </aside>;
}

function PropertySlider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="mt-4 space-y-2"><Label className="text-[9px] uppercase text-white/45">{label}</Label><Slider value={[value]} min={min} max={max} step={1} onValueChange={([next]) => onChange(next)} /></div>;
}
