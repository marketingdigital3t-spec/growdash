import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WIDGET_CATALOG, type WidgetDef, type WidgetType } from "@/lib/widgetCatalog";
import { Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onAdd: (w: WidgetDef) => void;
}

const CATEGORIES: WidgetDef["category"][] = ["KPI", "Gráfico", "Análise", "Tabela"];

export function AddWidgetDialog({ open, onOpenChange, onAdd }: Props) {
  const [cat, setCat] = useState<WidgetDef["category"]>("KPI");
  const items = WIDGET_CATALOG.filter((w) => !w.system && w.category === cat);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Adicionar visualização</DialogTitle></DialogHeader>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((c) => (
            <Button key={c} variant={cat === c ? "default" : "outline"} size="sm" onClick={() => setCat(c)}>{c}</Button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 max-h-[60vh] overflow-auto">
          {items.map((w) => (
            <button
              key={w.type}
              onClick={() => { onAdd(w); onOpenChange(false); }}
              className="text-left p-3 rounded-lg border bg-card hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{w.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{w.description}</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
