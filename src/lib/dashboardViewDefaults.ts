import { DASHBOARD_CANONICAL_LAYOUT_VERSION, DEFAULT_VIEW } from "@/lib/widgetCatalog";

interface DashboardViewShape {
  layout: any[];
  widgets: any[];
}

/**
 * Restores the original Growdash dashboard once for legacy saved views.
 *
 * Some saved views received the complete widget catalog in addition to the
 * standard dashboard, producing duplicated metrics and broken spacing. The
 * version marker lets us clean those views once while still preserving any
 * widgets that the user deliberately adds after the migration.
 */
export function ensureDefaultDashboardContent<T extends DashboardViewShape>(view: T): T {
  const defaultWidget = DEFAULT_VIEW.widgets.find((widget) => widget.type === "default_block")!;
  const defaultLayout = DEFAULT_VIEW.layout.find((item) => item.i === defaultWidget.id)!;
  const widgets = Array.isArray(view.widgets) ? view.widgets : [];
  const layout = Array.isArray(view.layout) ? view.layout : [];
  const existingDefault = widgets.find((widget) => widget.id === defaultWidget.id || widget.type === "default_block");
  const currentVersion = Number(existingDefault?.config?.canonicalLayoutVersion || 0);
  const hasDefaultLayout = layout.some((item) => item.i === defaultLayout.i);

  if (currentVersion >= DASHBOARD_CANONICAL_LAYOUT_VERSION) {
    if (hasDefaultLayout) return view;

    return {
      ...view,
      layout: [{ ...defaultLayout }, ...layout.filter((item) => item.i !== defaultLayout.i)],
    };
  }

  return {
    ...view,
    widgets: DEFAULT_VIEW.widgets.map((widget) => ({ ...widget, config: { ...widget.config } })),
    layout: DEFAULT_VIEW.layout.map((item) => ({ ...item })),
  };
}
