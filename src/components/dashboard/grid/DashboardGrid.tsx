import { useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - default export missing types alias
import RGL, { Responsive, WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WidgetRenderer } from "./WidgetRenderer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Eye, EyeOff, GripVertical, Plus, RotateCcw, Save, X } from "lucide-react";
import type { DashboardView } from "@/hooks/useDashboardViews";
import { getWidgetDef } from "@/lib/widgetCatalog";
import type { Sale } from "@/hooks/useSales";
import { cn } from "@/lib/utils";

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
];

const DASHBOARD_EDIT_EVENT_KEY = "growthos:dashboard-edit-mode";

function readHiddenWidgetIds(viewId: string) {
  try {
    return new Set(JSON.parse(localStorage.getItem(`growthos:dashboard-hidden-widgets:${viewId}`) || "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

export function DashboardGrid({ view, isEditing, onChange, onAddClick, onEditSale }: Props) {
  // Local state mirrors the persisted view, with auto-debounced save via onChange.
  const [layout, setLayout] = useState<any[]>(view.layout || []);
  const [widgets, setWidgets] = useState<any[]>(view.widgets || []);
  const [hiddenWidgetIds, setHiddenWidgetIds] = useState<Set<string>>(() => readHiddenWidgetIds(view.id));
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    setLayout(view.layout || []);
    setWidgets(view.widgets || []);
    setHiddenWidgetIds(readHiddenWidgetIds(view.id));
  }, [view.id]);

  function scheduleSave(nextLayout: any[], nextWidgets: any[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onChange(nextLayout, nextWidgets), 800);
  }

  // Build display layout: persisted widgets + system tail
  const fullLayout = useMemo(() => {
    const ids = new Set([...(widgets || []).map((w) => w.id), ...SYSTEM_TAIL.map((w) => w.id)]);
    const baseLayout = layout.filter((l) => ids.has(l.i));
    const placed = new Set(baseLayout.map((item) => item.i));
    const maxY = baseLayout.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    let y = maxY;
    const tail = SYSTEM_TAIL.filter((s) => !placed.has(s.id)).map((s) => {
      const item = { i: s.id, x: 0, y: y, w: s.layoutDefault.w, h: s.layoutDefault.h, minW: 3, minH: 3 };
      y += s.layoutDefault.h;
      return item;
    });
    return [...baseLayout, ...tail];
  }, [layout, widgets]);

  const fullWidgets = useMemo(() => [...widgets, ...SYSTEM_TAIL], [widgets]);
  const visibleLayout = useMemo(() => fullLayout.filter((item) => !hiddenWidgetIds.has(item.i)), [fullLayout, hiddenWidgetIds]);
  const visibleWidgets = useMemo(() => fullWidgets.filter((item) => !hiddenWidgetIds.has(item.id)), [fullWidgets, hiddenWidgetIds]);

  function onLayoutChange(next: any[]) {
    if (!isEditing) return;
    const nextIds = new Set(next.map((item) => item.i));
    const preservedHidden = fullLayout.filter((item) => hiddenWidgetIds.has(item.i) && !nextIds.has(item.i));
    const merged = [...next, ...preservedHidden];
    setLayout(merged);
    scheduleSave(merged, widgets);
  }

  function removeWidget(id: string) {
    const nextWidgets = widgets.filter((w) => w.id !== id);
    const nextLayout = layout.filter((l) => l.i !== id);
    setWidgets(nextWidgets);
    setLayout(nextLayout);
    scheduleSave(nextLayout, nextWidgets);
  }

  function persistHiddenIds(next: Set<string>) {
    setHiddenWidgetIds(next);
    localStorage.setItem(`growthos:dashboard-hidden-widgets:${view.id}`, JSON.stringify([...next]));
  }

  function toggleWidgetVisibility(id: string) {
    const next = new Set(hiddenWidgetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistHiddenIds(next);
  }

  function showAllWidgets() {
    persistHiddenIds(new Set());
  }

  function saveNow() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    onChange(layout, widgets);
  }

  function finishEditing() {
    saveNow();
    window.dispatchEvent(new CustomEvent(DASHBOARD_EDIT_EVENT_KEY, { detail: false }));
  }

  return (
    <div className="relative">
      {isEditing && (
        <div className="sticky top-0 z-30 mb-3 rounded-lg border border-primary/30 bg-background/92 p-3 shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <GripVertical className="h-4 w-4" />
                Editando dashboard
              </div>
              <p className="text-xs text-muted-foreground">
                Arraste pelo puxador, redimensione pelo canto inferior direito e marque quais blocos ficam visíveis.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={onAddClick} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Adicionar métrica
              </Button>
              <Button size="sm" variant="secondary" onClick={saveNow} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar layout
              </Button>
              <Button size="sm" variant="outline" onClick={showAllWidgets} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Mostrar todos
              </Button>
              <Button size="sm" variant="outline" onClick={finishEditing} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
              </Button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {fullWidgets.map((widget) => {
              const hidden = hiddenWidgetIds.has(widget.id);
              return (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => toggleWidgetVisibility(widget.id)}
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs transition",
                    hidden
                      ? "border-border bg-muted/30 text-muted-foreground"
                      : "border-primary/30 bg-primary/10 text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.08)]",
                  )}
                >
                  <span className="truncate font-medium">{widget.title}</span>
                  {hidden ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {visibleWidgets.length === 0 && (
        <div className="rounded-lg border border-dashed border-primary/30 bg-card/60 p-8 text-center">
          <p className="font-semibold">Nenhuma métrica visível</p>
          <p className="mt-1 text-sm text-muted-foreground">Ative pelo menos um bloco no painel de edição para montar o dashboard.</p>
          {isEditing && (
            <Button className="mt-4 gap-2" onClick={showAllWidgets}>
              <Eye className="h-4 w-4" /> Mostrar todos
            </Button>
          )}
        </div>
      )}
      <ResponsiveGrid
        className="layout"
        layouts={{ lg: visibleLayout, md: visibleLayout, sm: visibleLayout, xs: visibleLayout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 2 }}
        rowHeight={60}
        margin={[12, 12]}
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={onLayoutChange}
        draggableHandle=".dashboard-drag-handle"
        draggableCancel=".no-drag,button,input,select,textarea,a"
      >
        {visibleWidgets.map((w) => {
          const isSystem = w.id.startsWith("__sys_");
          return (
            <div key={w.id} className={cn("overflow-hidden", isEditing && "rounded-lg ring-1 ring-primary/45 ring-offset-2 ring-offset-background")}>
              {isEditing && (
                <div className="absolute left-2 top-2 z-20 flex items-center gap-1">
                  <button
                    type="button"
                    className="dashboard-drag-handle flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-primary/30 bg-background/90 text-primary shadow active:cursor-grabbing"
                    aria-label="Mover bloco"
                    title="Mover bloco"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWidgetVisibility(w.id)}
                    className="no-drag flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/90 text-muted-foreground shadow hover:text-primary"
                    aria-label="Ocultar bloco"
                    title="Ocultar bloco"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {isEditing && !isSystem && (
                <button
                  onClick={() => removeWidget(w.id)}
                  className="no-drag absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-destructive/90 text-destructive-foreground shadow hover:bg-destructive"
                  aria-label="Remover"
                  title="Remover métrica"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="h-full w-full no-drag-children">
                <WidgetRenderer type={w.type} title={w.title} config={w.config || {}} onEditSale={onEditSale} />
              </div>
              {isEditing && (
                <div className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-sm border-b-2 border-r-2 border-primary/70 p-1" />
              )}
            </div>
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}

export function buildWidgetFromDef(typeKey: string): { widget: any; layout: any } | null {
  const def = getWidgetDef(typeKey as any);
  if (!def) return null;
  const id = `${typeKey}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  return {
    widget: { id, type: def.type, title: def.title, config: { ...def.defaultConfig } },
    layout: { i: id, x: 0, y: 9999, w: def.defaultLayout.w, h: def.defaultLayout.h, minW: def.defaultLayout.minW, minH: def.defaultLayout.minH },
  };
}
