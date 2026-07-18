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
  const defaultWidget = DEFAULT_VIEW.widgets[0];
  const defaultLayout = DEFAULT_VIEW.layout[0];
  const widgets = Array.isArray(view.widgets) ? view.widgets : [];
  const layout = Array.isArray(view.layout) ? view.layout : [];
  const hasDefaultWidget = widgets.some((widget) => widget.id === defaultWidget.id || widget.type === "default_block");
  const hasDefaultLayout = layout.some((item) => item.i === defaultLayout.i);

  if (hasDefaultWidget && hasDefaultLayout) return view;

  const customWidgets = widgets.filter((widget) => widget.id !== defaultWidget.id && widget.type !== "default_block");
  const customLayout = layout.filter((item) => item.i !== defaultLayout.i);
  const yOffset = defaultLayout.h + 1;

  return {
    ...view,
    widgets: [{ ...defaultWidget, config: { ...defaultWidget.config } }, ...customWidgets],
    layout: [
      { ...defaultLayout },
      ...customLayout.map((item) => ({ ...item, y: Number(item.y || 0) + yOffset })),
    ],
  };
}
