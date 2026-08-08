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
  return <aside aria-label="Propriedades do elemento" className="growdash-flow-chrome growdash-flow-properties absolute bottom-16 left-3 top-28 z-30 w-[min(280px,calc(100%-1.5rem))] overflow-y-auto rounded-2xl p-4 2xl:top-16">
    <header className="mb-4 flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[.18em] text-primary">Propriedades</span><h3 className="mt-1 truncate text-sm font-black">{selectionCount > 1 ? `${selectionCount} elementos` : element.type}</h3></div><Button variant="ghost" size="icon" className="growdash-flow-control h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button></header>
    <div className="grid grid-cols-2 gap-2">
      {(["x", "y", "width", "height"] as const).map((key) => <div key={key} className="space-y-1"><Label className="growdash-flow-label text-[9px] uppercase">{{ x: "X", y: "Y", width: "Largura", height: "Altura" }[key]}</Label><Input type="number" value={Math.round(element[key])} onChange={numberChange(key)} className="growdash-flow-input h-8 text-xs" disabled={selectionCount > 1} /></div>)}
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="growdash-flow-label text-[9px] uppercase">Preenchimento</Label><input type="color" value={element.fillColor === "transparent" ? "#ffffff" : element.fillColor} onChange={(event) => onChange({ fillColor: event.target.value })} className="growdash-flow-color-input h-9 w-full cursor-pointer rounded-lg p-1" /></div><div className="space-y-1"><Label className="growdash-flow-label text-[9px] uppercase">Borda</Label><input type="color" value={element.strokeColor} onChange={(event) => onChange({ strokeColor: event.target.value })} className="growdash-flow-color-input h-9 w-full cursor-pointer rounded-lg p-1" /></div></div>
    <PropertySlider label={`Espessura · ${element.strokeWidth}px`} value={element.strokeWidth} min={1} max={10} onChange={(value) => onChange({ strokeWidth: value })} />
    <PropertySlider label={`Opacidade · ${Math.round(element.opacity * 100)}%`} value={element.opacity * 100} min={0} max={100} onChange={(value) => onChange({ opacity: value / 100 })} />
    <PropertySlider label={`Rotação · ${Math.round(element.rotation)}°`} value={element.rotation} min={0} max={360} onChange={(value) => onChange({ rotation: value })} />
    {(element.type === "text" || element.type === "sticky") && <PropertySlider label={`Texto · ${element.fontSize || 20}px`} value={element.fontSize || 20} min={10} max={72} onChange={(value) => onChange({ fontSize: value })} />}
    <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="growdash-flow-secondary-action" onClick={onFront}><ArrowUpToLine className="mr-1.5 h-3.5 w-3.5" />Frente</Button><Button variant="outline" size="sm" className="growdash-flow-secondary-action" onClick={onBack}><ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />Fundo</Button></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" className="growdash-flow-secondary-action" onClick={onDuplicate}><Copy className="mr-1.5 h-3.5 w-3.5" />Duplicar</Button><Button variant="outline" size="sm" className="growdash-flow-secondary-action" onClick={() => onChange({ locked: !element.locked })}>{element.locked ? <Unlock className="mr-1.5 h-3.5 w-3.5" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}{element.locked ? "Destravar" : "Travar"}</Button></div>
    <Button variant="outline" size="sm" className="growdash-flow-danger-action mt-2 w-full" onClick={onDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>
  </aside>;
}

function PropertySlider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <div className="mt-4 space-y-2"><Label className="growdash-flow-label text-[9px] uppercase">{label}</Label><Slider value={[value]} min={min} max={max} step={1} onValueChange={([next]) => onChange(next)} /></div>;
}
