import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
// @ts-ignore - default export missing types alias
import RGL, { Responsive } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WidgetRenderer } from "./WidgetRenderer";
import { Settings2, X } from "lucide-react";
import type { DashboardView } from "@/hooks/useDashboardViews";
import { getWidgetDef } from "@/lib/widgetCatalog";
import type { Sale } from "@/hooks/useSales";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildResponsiveDashboardLayout,
  findDashboardSlot,
  normalizeDesktopDashboardLayout,
  type DashboardGridItem,
} from "@/lib/responsiveDashboardLayout";
import { DashboardWidgetConfigDialog } from "./DashboardWidgetConfigDialog";
import { DashboardWidgetHelp } from "@/components/dashboard/DashboardWidgetHelp";

const ResponsiveGrid = Responsive;
const GRID_ROW_HEIGHT = 60;
const GRID_MARGIN_Y = 12;

interface Props {
  view: DashboardView;
  isEditing: boolean;
  onChange: (layout: any[], widgets: any[]) => void;
  onAddClick?: () => void;
  onEditSale: (s: Sale) => void;
}

// System widgets always appended at the end (not persisted in view.widgets)
const SYSTEM_TAIL = [
  { id: "__sys_campaigns", type: "campaigns_detail", title: "Detalhamento por Campanha", config: {}, layoutDefault: { w: 12, h: 6 } },
  { id: "__sys_ask_ai", type: "ask_ai", title: "Pergunte à IA", config: {}, layoutDefault: { w: 12, h: 4 } },
];

function pixelsToGridRows(height: number) {
  return Math.max(1, Math.ceil((height + GRID_MARGIN_Y) / (GRID_ROW_HEIGHT + GRID_MARGIN_Y)));
}

function AutoHeightWidget({
  widgetId,
  onHeightChange,
  children,
}: {
  widgetId: string;
  onHeightChange: (widgetId: string, rows: number) => void;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const reportHeight = () => {
      const height = Math.ceil(content.getBoundingClientRect().height);
      if (height > 0) onHeightChange(widgetId, pixelsToGridRows(height));
    };

    reportHeight();
    const observer = new ResizeObserver(reportHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [onHeightChange, widgetId]);

  return <div ref={contentRef} className="min-w-0 w-full">{children}</div>;
}

function appendSystemTail(baseLayout: DashboardGridItem[], columns: number, widgetIds: Set<string>) {
  const visibleLayout = baseLayout.filter((item) => widgetIds.has(item.i));
  const maxY = visibleLayout.reduce((maximum, item) => Math.max(maximum, item.y + item.h), 0);
  let y = maxY;
  const tail = SYSTEM_TAIL.map((systemWidget) => {
    const item = { i: systemWidget.id, x: 0, y, w: columns, h: systemWidget.layoutDefault.h, static: true };
    y += systemWidget.layoutDefault.h;
    return item;
  });
  return [...visibleLayout, ...tail];
}

export function DashboardGrid({ view, isEditing, onChange, onEditSale }: Props) {
  const isMobile = useIsMobile();
  const [breakpoint, setBreakpoint] = useState("lg");
  // Local state mirrors the persisted view, with auto-debounced save via onChange.
  const [layout, setLayout] = useState<any[]>(view.layout || []);
  const [widgets, setWidgets] = useState<any[]>(view.widgets || []);
  const [autoHeightRows, setAutoHeightRows] = useState<Record<string, number>>({});
  const [configuringWidgetId, setConfiguringWidgetId] = useState<string | null>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  // The sidebar changes the usable content width without firing window.resize.
  // Measuring this element (rather than the browser viewport) prevents RGL
  // from positioning cards behind the right edge after the menu is toggled.
  useLayoutEffect(() => {
    const element = gridContainerRef.current;
    if (!element) return;
    const update = () => setGridWidth(Math.max(0, Math.floor(element.getBoundingClientRect().width)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setLayout(view.layout || []);
    setWidgets(view.widgets || []);
    setAutoHeightRows({});
  }, [view.id, view.layout, view.widgets]);

  const handleAutoHeight = useCallback((widgetId: string, rows: number) => {
    setAutoHeightRows((current) => current[widgetId] === rows ? current : { ...current, [widgetId]: rows });
  }, []);

  const desktopLayout = useMemo(() =>
    normalizeDesktopDashboardLayout(layout, widgets, 12),
  [layout, widgets]);

  const responsiveLayouts = useMemo(() => {
    const widgetIds = new Set((widgets || []).map((widget) => widget.id));
    const defaultIds = new Set((widgets || []).filter((widget) => widget.type === "default_block").map((widget) => widget.id));
    const applyAutoHeight = (items: DashboardGridItem[]) => items.map((item) => ({
      ...item,
      ...(!isEditing && autoHeightRows[item.i] ? { h: autoHeightRows[item.i] } : {}),
      ...(defaultIds.has(item.i) ? { static: true } : {}),
    }));
    const lg = applyAutoHeight(buildResponsiveDashboardLayout(desktopLayout, 12, 12));
    const md = applyAutoHeight(buildResponsiveDashboardLayout(desktopLayout, 12, 8));
    const sm = applyAutoHeight(buildResponsiveDashboardLayout(desktopLayout, 12, 4));
    return {
      lg: appendSystemTail(lg, 12, widgetIds),
      md: appendSystemTail(md, 8, widgetIds),
      sm: appendSystemTail(sm, 4, widgetIds),
    };
  }, [autoHeightRows, desktopLayout, isEditing, widgets]);

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

  function onLayoutChange(next: any[], allLayouts?: Record<string, any[]>) {
    if (!isEditing) return;
    // strip system widgets
    const desktopNext = allLayouts?.lg ?? (breakpoint === "lg" ? next : layout);
    const userOnly = desktopNext.filter((l) => !l.i.startsWith("__sys_"));
    if (layoutsEqual(userOnly, layout)) return;
    setLayout(userOnly);
    onChange(userOnly, widgets);
  }


  function removeWidget(id: string) {
    const nextWidgets = widgets.filter((w) => w.id !== id);
    const nextLayout = layout.filter((l) => l.i !== id);
    setWidgets(nextWidgets);
    setLayout(nextLayout);
    onChange(nextLayout, nextWidgets);
  }

  function updateWidget(id: string, patch: { title: string; config: any }) {
    const nextWidgets = widgets.map((widget) => widget.id === id ? { ...widget, ...patch } : widget);
    setWidgets(nextWidgets);
    onChange(layout, nextWidgets);
  }

  const configuringWidget = widgets.find((widget) => widget.id === configuringWidgetId) || null;

  if (isMobile) {
    return <><div className="min-w-0 space-y-4 overflow-x-clip">
      {fullWidgets.map((widget) => {
        const isSystem = widget.id.startsWith("__sys_") || widget.type === "default_block";
        return <section key={widget.id} className="relative min-w-0 max-w-full overflow-hidden rounded-xl">
          {isEditing && !isSystem && <div className="no-drag absolute right-2 top-2 z-20 flex gap-1"><button onClick={() => setConfiguringWidgetId(widget.id)} className="grid h-11 w-11 place-items-center rounded-full bg-background/95 text-primary shadow" aria-label={`Configurar ${widget.title}`}><Settings2 className="h-4 w-4" /></button><button onClick={() => removeWidget(widget.id)} className="grid h-11 w-11 place-items-center rounded-full bg-destructive/90 text-destructive-foreground shadow" aria-label="Remover"><X className="h-4 w-4" /></button></div>}
          <DashboardWidgetHelp type={widget.type} title={widget.title} className="min-w-0 max-w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"><WidgetRenderer type={widget.type} title={widget.title} config={widget.config || {}} onEditSale={onEditSale} /></DashboardWidgetHelp>
        </section>;
      })}
    </div><DashboardWidgetConfigDialog widget={configuringWidget} open={!!configuringWidget} onOpenChange={(open) => !open && setConfiguringWidgetId(null)} onSave={(patch) => { if (configuringWidget) updateWidget(configuringWidget.id, patch); }} /></>;
  }

  return (
    <div ref={gridContainerRef} className="dashboard-grid-container relative min-w-0 max-w-full overflow-x-clip">
      {gridWidth > 0 && <ResponsiveGrid
        width={gridWidth}
        className={isEditing ? "layout dashboard-layout-editing" : "layout"}
        layouts={responsiveLayouts}
        breakpoints={{ lg: 1280, md: 900, sm: 0 }}
        cols={{ lg: 12, md: 8, sm: 4 }}
        rowHeight={GRID_ROW_HEIGHT}
        margin={[12, GRID_MARGIN_Y]}
        compactType="vertical"
        preventCollision={false}
        isDraggable={isEditing && breakpoint === "lg"}
        isResizable={isEditing && breakpoint === "lg"}
        // Com containerPadding implícito igual à margem, o RGL subtrai 12px
        // do primeiro delta quando isBounded=true. Isso fazia o widget saltar
        // para a esquerda e para cima ao iniciar qualquer arraste. O próprio
        // cálculo de x/y do grid continua limitando a posição ao soltar.
        isBounded={false}
        useCSSTransforms={true}
        onLayoutChange={onLayoutChange}
        onBreakpointChange={setBreakpoint}
        draggableCancel=".no-drag,button,input,select,textarea,a"
      >

        {fullWidgets.map((w) => {
          const isSystem = w.id.startsWith("__sys_") || w.type === "default_block";
          return (
            <div key={w.id} className={w.type === "default_block" ? "dashboard-default-static overflow-hidden" : "overflow-hidden"}>
              {isEditing && !isSystem && <div className="no-drag absolute right-1 top-1 z-20 flex gap-1"><button onClick={() => setConfiguringWidgetId(w.id)} className="flex h-6 w-6 items-center justify-center rounded-full bg-background/95 text-primary shadow" aria-label={`Configurar ${w.title}`}><Settings2 className="h-3 w-3" /></button><button onClick={() => removeWidget(w.id)} className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow hover:bg-destructive" aria-label="Remover"><X className="h-3 w-3" /></button></div>}
              <DashboardWidgetHelp type={w.type} title={w.title} className="dashboard-widget-shell h-full w-full no-drag-children outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                {w.type === "default_block" ? (
                  <AutoHeightWidget widgetId={w.id} onHeightChange={handleAutoHeight}>
                    <WidgetRenderer type={w.type} title={w.title} config={w.config || {}} onEditSale={onEditSale} />
                  </AutoHeightWidget>
                ) : (
                  <WidgetRenderer type={w.type} title={w.title} config={w.config || {}} onEditSale={onEditSale} />
                )}
              </DashboardWidgetHelp>
            </div>
          );
        })}
      </ResponsiveGrid>}
      <DashboardWidgetConfigDialog widget={configuringWidget} open={!!configuringWidget} onOpenChange={(open) => !open && setConfiguringWidgetId(null)} onSave={(patch) => { if (configuringWidget) updateWidget(configuringWidget.id, patch); }} />
    </div>
  );
}

export function buildWidgetFromDef(typeKey: string, existingLayout: any[] = []): { widget: any; layout: any } | null {
  const def = getWidgetDef(typeKey as any);
  if (!def) return null;
  const id = `${typeKey}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const slot = findDashboardSlot(existingLayout, def.defaultLayout.w, def.defaultLayout.h, 12);
  return {
    widget: { id, type: def.type, title: def.title, config: { ...def.defaultConfig } },
    layout: { i: id, x: slot.x, y: slot.y, w: def.defaultLayout.w, h: def.defaultLayout.h, minW: def.defaultLayout.minW, minH: def.defaultLayout.minH },
  };

}
