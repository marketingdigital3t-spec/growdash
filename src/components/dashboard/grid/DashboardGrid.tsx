import { useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - default export missing types alias
import RGL, { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WidgetRenderer } from "./WidgetRenderer";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { DashboardView } from "@/hooks/useDashboardViews";
import { getWidgetDef } from "@/lib/widgetCatalog";
import type { Sale } from "@/hooks/useSales";
import { useIsMobile } from "@/hooks/use-mobile";

const ResponsiveGrid = WidthProvider(Responsive);

interface Props {
  view: DashboardView;
  isEditing: boolean;
  onChange: (layout: any[], widgets: any[]) => void;
  onAddClick: () => void;
  onEditSale: (s: Sale) => void;
}

// System widgets always appended at the end (not persisted in view.widgets)
const SYSTEM_TAIL = [
  { id: "__sys_budget", type: "budget_bm", title: "Análise de Orçamento", config: {}, layoutDefault: { w: 12, h: 5 } },
  { id: "__sys_campaigns", type: "campaigns_detail", title: "Detalhamento por Campanha", config: {}, layoutDefault: { w: 12, h: 6 } },
  { id: "__sys_ask_ai", type: "ask_ai", title: "Pergunte à IA", config: {}, layoutDefault: { w: 12, h: 4 } },
];

export function DashboardGrid({ view, isEditing, onChange, onAddClick, onEditSale }: Props) {
  const isMobile = useIsMobile();
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches,
  );
  // Local state mirrors the persisted view, with auto-debounced save via onChange.
  const [layout, setLayout] = useState<any[]>(view.layout || []);
  const [widgets, setWidgets] = useState<any[]>(view.widgets || []);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    setLayout(view.layout || []);
    setWidgets(view.widgets || []);
  }, [view.id]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setIsCompact(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);

  function scheduleSave(nextLayout: any[], nextWidgets: any[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onChange(nextLayout, nextWidgets), 800);
  }

  // Build display layout: persisted widgets + system tail
  const fullLayout = useMemo(() => {
    const ids = new Set((widgets || []).map((w) => w.id));
    const baseLayout = layout.filter((l) => ids.has(l.i));
    // Compute true max Y considering compaction would have brought items up.
    const maxY = baseLayout.reduce((m, l) => Math.max(m, (l.y || 0) + (l.h || 0)), 0);
    let y = maxY;
    const tail = SYSTEM_TAIL.map((s) => {
      const item = { i: s.id, x: 0, y, w: s.layoutDefault.w, h: s.layoutDefault.h, static: true };
      y += s.layoutDefault.h;
      return item;
    });
    return [...baseLayout, ...tail];
  }, [layout, widgets]);

  const fullWidgets = useMemo(() => [...widgets, ...SYSTEM_TAIL], [widgets]);

  function layoutsEqual(a: any[], b: any[]) {
    if (a.length !== b.length) return false;
    const bm = new Map(b.map((l) => [l.i, l]));
    for (const l of a) {
      const o = bm.get(l.i);
      if (!o || o.x !== l.x || o.y !== l.y || o.w !== l.w || o.h !== l.h) return false;
    }
    return true;
  }

  function onLayoutChange(next: any[]) {
    // strip system widgets
    const userOnly = next.filter((l) => !l.i.startsWith("__sys_"));
    if (layoutsEqual(userOnly, layout)) return;
    setLayout(userOnly);
    if (isEditing) scheduleSave(userOnly, widgets);
  }


  function removeWidget(id: string) {
    const nextWidgets = widgets.filter((w) => w.id !== id);
    const nextLayout = layout.filter((l) => l.i !== id);
    setWidgets(nextWidgets);
    setLayout(nextLayout);
    scheduleSave(nextLayout, nextWidgets);
  }

  if (isMobile || isCompact) {
    return <div className="min-w-0 space-y-4 overflow-x-clip">
      {isEditing && <div className="sticky top-[160px] z-10 flex justify-end"><Button size="sm" onClick={onAddClick} className="min-h-11 gap-1.5 shadow"><Plus className="h-3.5 w-3.5" />Adicionar widget</Button></div>}
      {fullWidgets.map((widget) => {
        const isSystem = widget.id.startsWith("__sys_");
        return <section key={widget.id} className="relative min-w-0 max-w-full overflow-hidden rounded-xl">
          {isEditing && !isSystem && <button onClick={() => removeWidget(widget.id)} className="no-drag absolute right-2 top-2 z-20 grid h-11 w-11 place-items-center rounded-full bg-destructive/90 text-destructive-foreground shadow" aria-label="Remover"><X className="h-4 w-4" /></button>}
          <div className="min-w-0 max-w-full overflow-hidden"><WidgetRenderer type={widget.type} title={widget.title} config={widget.config || {}} onEditSale={onEditSale} /></div>
        </section>;
      })}
    </div>;
  }

  return (
    <div className="relative min-w-0 max-w-full overflow-x-clip">
      {isEditing && (
        <div className="sticky top-0 z-30 flex justify-end mb-2">
          <Button size="sm" onClick={onAddClick} className="gap-1.5 shadow">
            <Plus className="h-3.5 w-3.5" /> Adicionar widget
          </Button>
        </div>
      )}
      <ResponsiveGrid
        className="layout"
        layouts={{ lg: fullLayout, md: fullLayout, sm: fullLayout, xs: fullLayout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 2 }}
        rowHeight={60}
        margin={[12, 12]}
        compactType="vertical"
        preventCollision={false}
        isDraggable={isEditing}
        isResizable={isEditing}
        isBounded={true}
        useCSSTransforms={true}
        onLayoutChange={onLayoutChange}
        draggableCancel=".no-drag,button,input,select,textarea,a"
      >

        {fullWidgets.map((w) => {
          const isSystem = w.id.startsWith("__sys_");
          return (
            <div key={w.id} className="overflow-hidden">
              {isEditing && !isSystem && (
                <button
                  onClick={() => removeWidget(w.id)}
                  className="no-drag absolute top-1 right-1 z-20 h-6 w-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center hover:bg-destructive shadow"
                  aria-label="Remover"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <div className="h-full w-full no-drag-children">
                <WidgetRenderer type={w.type} title={w.title} config={w.config || {}} onEditSale={onEditSale} />
              </div>
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}

export function buildWidgetFromDef(typeKey: string, existingLayout: any[] = []): { widget: any; layout: any } | null {
  const def = getWidgetDef(typeKey as any);
  if (!def) return null;
  const id = `${typeKey}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const maxY = (existingLayout || []).reduce((m, l) => Math.max(m, (l.y || 0) + (l.h || 0)), 0);
  return {
    widget: { id, type: def.type, title: def.title, config: { ...def.defaultConfig } },
    layout: { i: id, x: 0, y: maxY, w: def.defaultLayout.w, h: def.defaultLayout.h, minW: def.defaultLayout.minW, minH: def.defaultLayout.minH },
  };

}
