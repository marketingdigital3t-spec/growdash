import { DEFAULT_VIEW } from "@/lib/widgetCatalog";

interface DashboardViewShape {
  layout: any[];
  widgets: any[];
}

/**
 * The legacy dashboard is the complete operational overview and must never
 * disappear when a custom view is edited. Keep it at the top and preserve
 * every custom widget below it.
 */
export function ensureDefaultDashboardContent<T extends DashboardViewShape>(view: T): T {
  const defaultWidget = DEFAULT_VIEW.widgets.find((widget) => widget.type === "default_block")!;
  const defaultLayout = DEFAULT_VIEW.layout.find((item) => item.i === defaultWidget.id)!;
  const widgets = Array.isArray(view.widgets) ? view.widgets : [];
  const layout = Array.isArray(view.layout) ? view.layout : [];
  const legacyDefault = widgets.find((widget) => widget.id === defaultWidget.id || widget.type === "default_block");
  const hasDefaultWidget = !!legacyDefault;
  const hasDefaultLayout = layout.some((item) => item.i === defaultLayout.i);

  // Layouts já migrados guardam este marcador. Assim, se o usuário ocultar um
  // KPI individual no editor, ele não reaparece na próxima consulta.
  if (hasDefaultWidget && hasDefaultLayout && legacyDefault?.config?.individualized) return view;

  if (hasDefaultWidget && hasDefaultLayout) {
    const primaryWidgets = DEFAULT_VIEW.widgets.filter((widget) => widget.type === "kpi");
    const primaryLayouts = DEFAULT_VIEW.layout.filter((item) => item.i.startsWith("primary-"));
    return {
      ...view,
      widgets: [
        ...primaryWidgets.map((widget) => ({ ...widget, config: { ...widget.config } })),
        ...widgets.map((widget) => widget === legacyDefault
          ? { ...widget, config: { ...(widget.config || {}), hidePrimary: true, individualized: true } }
          : widget),
      ],
      layout: [
        ...primaryLayouts.map((item) => ({ ...item })),
        ...layout.map((item) => item.i === defaultLayout.i
          ? { ...item, y: Math.max(2, Number(item.y || 0) + 2), minW: Math.min(Number(item.minW || 12), 6) }
          : { ...item, y: Number(item.y || 0) + 2 }),
      ],
    };
  }

  const customWidgets = widgets.filter((widget) => widget.id !== defaultWidget.id && widget.type !== "default_block");
  const customLayout = layout.filter((item) => item.i !== defaultLayout.i);
  const yOffset = defaultLayout.h + defaultLayout.y + 1;

  return {
    ...view,
    widgets: [...DEFAULT_VIEW.widgets.map((widget) => ({ ...widget, config: { ...widget.config } })), ...customWidgets],
    layout: [
      ...DEFAULT_VIEW.layout.map((item) => ({ ...item })),
      ...customLayout.map((item) => ({ ...item, y: Number(item.y || 0) + yOffset })),
    ],
  };
}
